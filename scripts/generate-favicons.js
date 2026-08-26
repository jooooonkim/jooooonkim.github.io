#!/usr/bin/env node
// Rasterizes images/favicon.svg into the PNG sizes browsers actually request
// (SVG favicons aren't supported everywhere - notably Safari/iOS ignore
// rel="icon" type="image/svg+xml" and fall back to apple-touch-icon or
// nothing). Run with `node scripts/generate-favicons.js` or `npm run
// build:favicons` after editing images/favicon.svg.

'use strict';

const path = require('path');
const sharp = require('sharp');

const SRC = path.join(__dirname, '..', 'images', 'favicon.svg');
const OUT_DIR = path.join(__dirname, '..', 'images');

const TARGETS = [
  { file: 'favicon-16.png', size: 16 },
  { file: 'favicon-32.png', size: 32 },
  { file: 'favicon-48.png', size: 48 },
  { file: 'apple-touch-icon.png', size: 180 }, // iOS home-screen icon size
];

async function main() {
  for (const { file, size } of TARGETS) {
    const outPath = path.join(OUT_DIR, file);
    await sharp(SRC, { density: 384 }) // high density so small raster sizes stay crisp
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`wrote ${path.relative(process.cwd(), outPath)} (${size}x${size})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
