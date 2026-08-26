#!/usr/bin/env node
// Re-encodes the hero background video and extracts a poster frame from it.
// Run with `node scripts/optimize-hero-video.js`.
//
// Why this exists: the portfolio audit (2026-08) found images/square-and-
// full-hero.mp4 autoplaying on index.html with no `poster` attribute, so
// visitors on a slow connection see a blank dark hero band until the whole
// file downloads. The source file was also a straight camera export -
// 1280x720 h264 at a flat ~1300kbps CBR, PLUS a silent AAC audio track that
// can never be heard (the <video> tag is muted) and exists purely as dead
// weight.
//
// This script:
//   1. Extracts a poster frame at t=1.5s (skips the first ~1s in case of a
//      black/transitional opening frame) as a JPEG.
//   2. Re-encodes the video: same resolution (1280x720 - already modest,
//      and this plays under a 70% dark overlay per css/style.css
//      .hero-section::before, so extra fidelity buys nothing visible),
//      CRF 26 (visually strong for background-loop content, well below
//      broadcast/foreground quality needs), veryslow preset (one-time
//      build cost buys meaningfully better compression at the same
//      quality), no audio track, +faststart for progressive playback.

'use strict';

const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(require('ffmpeg-static'));
ffmpeg.setFfprobePath(require('ffprobe-static').path);

const SRC = path.join(__dirname, '..', 'images', 'square-and-full-hero.mp4');
const POSTER = path.join(__dirname, '..', 'images', 'hero-poster.jpg');
const TMP_VIDEO = path.join(__dirname, '..', 'images', '.square-and-full-hero.tmp.mp4');

function extractPoster() {
  return new Promise((resolve, reject) => {
    ffmpeg(SRC)
      .on('end', resolve)
      .on('error', reject)
      .screenshots({
        timestamps: [1.5],
        filename: path.basename(POSTER),
        folder: path.dirname(POSTER),
        size: '1280x720',
      });
  });
}

function reencodeVideo() {
  return new Promise((resolve, reject) => {
    ffmpeg(SRC)
      .videoCodec('libx264')
      .noAudio()
      .outputOptions(['-crf 26', '-preset veryslow', '-movflags +faststart', '-pix_fmt yuv420p'])
      .size('1280x720')
      .on('end', resolve)
      .on('error', reject)
      .save(TMP_VIDEO);
  });
}

async function main() {
  console.log('Extracting poster frame...');
  await extractPoster();
  console.log(`wrote ${path.relative(process.cwd(), POSTER)}`);

  console.log('Re-encoding video (this takes a minute at veryslow preset)...');
  await reencodeVideo();

  const before = fs.statSync(SRC).size;
  const after = fs.statSync(TMP_VIDEO).size;

  if (after >= before) {
    fs.unlinkSync(TMP_VIDEO);
    console.log(`Re-encode was not smaller (${before} -> ${after} bytes) - kept the original.`);
    return;
  }

  fs.renameSync(TMP_VIDEO, SRC);
  console.log(
    `wrote ${path.relative(process.cwd(), SRC)}  ${(before / 1024 / 1024).toFixed(2)}MB -> ` +
      `${(after / 1024 / 1024).toFixed(2)}MB (-${(100 * (1 - after / before)).toFixed(0)}%)`
  );
}

main().catch((err) => {
  console.error(err);
  if (fs.existsSync(TMP_VIDEO)) fs.unlinkSync(TMP_VIDEO);
  process.exit(1);
});
