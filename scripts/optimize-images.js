#!/usr/bin/env node
// Re-encodes and (where oversized) downsamples every content JPEG/PNG under
// images/ and projects/*/images/ in place - same filename, same extension,
// so no HTML/CSS reference needs to change. Run with `node
// scripts/optimize-images.js --dry-run` to preview, or without the flag to
// apply. Re-run any time new project photos are added.
//
// Why this exists: the portfolio audit (2026-08) found several images
// wildly oversized for how they're actually displayed - e.g. a 3158x3158,
// 1.1MB avatar photo serving into a 144x144px circle, and six 4032x3024
// (12MP, ~1.2MB each) camera photos on the gear-train page. No image on
// this site is ever displayed wider than roughly a 1152px (max-w-6xl)
// container, so nothing needs to ship at native camera/screenshot
// resolution.
//
// Policy:
//   - "thumbnail" tier (images/temp-*-small.*, the project-card images used
//     in a 3-column grid at ~h-56/224px tall): cap the longest side at 900px.
//   - "content" tier (everything else): cap the longest side at 1400px -
//     generous headroom above this site's widest single-column image
//     context, even accounting for ~1.2x pixel density.
//   - Only ever downsizes, never upscales.
//   - JPEG re-encoded at quality 78 with mozjpeg (a well-established sweet
//     spot: visually near-lossless for photographic content, big size win).
//   - PNG re-encoded with palette quantization (quality 80) - pngquant-style
//     lossy compression, appropriate here since none of these PNGs carry
//     transparency (verified below; the script hard-fails rather than
//     silently degrading a PNG that turns out to need alpha).
//   - Skips anything already under 60KB: not worth the re-encode risk for
//     negligible gain.

'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['graphify-out', 'node_modules', '.git']);
const SKIP_BELOW_BYTES = 60 * 1024;

const THUMBNAIL_PATTERN = /(?:^|[\\/])images[\\/]temp-.*-small\.(?:png|jpe?g)$/i;
const THUMBNAIL_MAX = 900;
const CONTENT_MAX = 1400;

const JPEG_QUALITY = 78;
const PNG_QUALITY = 80;

const dryRun = process.argv.includes('--dry-run');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(jpe?g|png)$/i.test(entry.name) && !/^(favicon|apple-touch-icon)/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

async function processOne(file) {
  const before = fs.statSync(file).size;
  if (before < SKIP_BELOW_BYTES) {
    return { file, before, after: before, skipped: 'already small' };
  }

  // Read the whole file into memory once and work from that buffer for
  // every subsequent sharp() call, rather than re-opening `file` by path
  // multiple times. Windows will intermittently refuse to write back to a
  // path that a prior sharp() call against that same path still has mapped
  // (libvips keeps the source memory-mapped after the promise resolves) -
  // reading once up front sidesteps the conflict entirely instead of
  // retrying around a flaky write.
  const inputBuffer = fs.readFileSync(file);

  const meta = await sharp(inputBuffer).metadata();
  let removeAlpha = false;
  if (meta.hasAlpha) {
    // Only proceed if every pixel's alpha is fully opaque (min===max===255) -
    // i.e. the channel is an inert export artifact, not real transparency.
    // A file with any actual translucency fails loudly instead of silently
    // flattening content that needs it.
    const stats = await sharp(inputBuffer).stats();
    const alphaChannel = stats.channels[stats.channels.length - 1];
    if (alphaChannel.min !== 255 || alphaChannel.max !== 255) {
      throw new Error(
        `${file} has a genuinely translucent alpha channel (min ${alphaChannel.min}, max ${alphaChannel.max}) - ` +
          `stopping rather than silently flattening it; handle this file manually.`
      );
    }
    removeAlpha = true;
  }

  const isThumbnail = THUMBNAIL_PATTERN.test(file.replace(/\\/g, '/'));
  const cap = isThumbnail ? THUMBNAIL_MAX : CONTENT_MAX;
  const longestSide = Math.max(meta.width, meta.height);
  const needsResize = longestSide > cap;

  let pipeline = sharp(inputBuffer);
  if (removeAlpha) {
    pipeline = pipeline.removeAlpha();
  }
  if (needsResize) {
    pipeline = pipeline.resize({
      width: meta.width >= meta.height ? cap : undefined,
      height: meta.height > meta.width ? cap : undefined,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') {
    pipeline = pipeline.png({ quality: PNG_QUALITY, palette: true, compressionLevel: 9 });
  } else {
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
  }

  const buffer = await pipeline.toBuffer();

  // Only ever keep the result if it's actually smaller - never regress a file.
  if (buffer.length >= before) {
    return { file, before, after: before, skipped: 're-encode was not smaller' };
  }

  if (!dryRun) {
    fs.writeFileSync(file, buffer);
  }

  return {
    file,
    before,
    after: buffer.length,
    resized: needsResize ? `${meta.width}x${meta.height} -> max ${cap}px` : null,
  };
}

async function main() {
  const files = walk(ROOT).sort();
  let totalBefore = 0;
  let totalAfter = 0;
  const results = [];

  for (const file of files) {
    const r = await processOne(file);
    totalBefore += r.before;
    totalAfter += r.after;
    results.push(r);
  }

  for (const r of results) {
    const rel = path.relative(ROOT, r.file);
    if (r.skipped) {
      console.log(`  skip   ${rel}  (${r.skipped})`);
      continue;
    }
    const pct = (100 * (1 - r.after / r.before)).toFixed(0);
    const resizeNote = r.resized ? `  [${r.resized}]` : '';
    console.log(
      `${dryRun ? 'would' : 'did  '}  ${rel}  ${(r.before / 1024).toFixed(0)}KB -> ${(r.after / 1024).toFixed(0)}KB (-${pct}%)${resizeNote}`
    );
  }

  console.log(
    `\nTotal: ${(totalBefore / 1024 / 1024).toFixed(2)}MB -> ${(totalAfter / 1024 / 1024).toFixed(2)}MB ` +
      `(-${(100 * (1 - totalAfter / totalBefore)).toFixed(0)}%)${dryRun ? '  [dry run - nothing written]' : ''}`
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
