#!/usr/bin/env node
// Verifies WCAG 2.1 color-contrast compliance for every real text/background
// color pairing used on the site (css/style.css). Zero dependencies - run with
// `node scripts/check-contrast.js` or `npm test`.
//
// Why this exists: the portfolio audit (2026-08) found the "View Details"
// project-card link rendering goldenrod-on-white at 2.31:1, well under the
// WCAG AA minimum. That kind of regression is invisible to the eye until you
// actually measure it - a future palette tweak could just as easily
// reintroduce it (here or elsewhere). This script pins every current pairing
// so a future edit to css/style.css that breaks contrast fails loudly instead
// of shipping silently.
//
// If you add a new color pairing to the site, add it to PAIRS below.

'use strict';

// --- WCAG 2.1 contrast math (relative luminance -> contrast ratio) ---------

function relativeLuminance(hex) {
  const channels = hex
    .match(/\w\w/g)
    .map((c) => parseInt(c, 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  const [r, g, b] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA) + 0.05;
  const l2 = relativeLuminance(hexB) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}

// WCAG AA thresholds. "Large" text is >=24px, or >=18.66px (14pt) and bold.
const AA_NORMAL = 4.5;
const AA_LARGE = 3.0;

// WCAG 1.4.11 non-text contrast minimum (UI components/focus indicators).
const AA_NON_TEXT = 3.0;

// --- Color tokens, mirrored from css/style.css :root ------------------------
// (Kept as a literal copy rather than parsed from the CSS file: a hand-parsed
// CSS reader would be more "automatic" but also more fragile and harder to
// audit at a glance than eight hex codes. If these drift from style.css, the
// values here stop being ground truth - keep the two in sync by hand.)

const COLORS = {
  darkBrownTaupe: '563727',
  darkGreyBrown: '372C2E',
  white: 'FFFFFF',
  goldenrod: 'DE9E48',
  goldenrodDark: '97621B',
  mediumBrown: '7A431D',
  offWhiteSection: 'F8F8F8', // section background used behind #projects/#contact
  lightGray100: 'F3F4F6', // Tailwind bg-gray-100, used for card panels on project pages
};

// --- Every real text/background pairing rendered on the site ---------------
// size: 'normal' or 'large' (per the WCAG definition above)

const PAIRS = [
  {
    name: 'Body text on white page background',
    fg: COLORS.darkBrownTaupe,
    bg: COLORS.white,
    size: 'normal',
    where: 'body { color }',
  },
  {
    name: 'Nav links at rest, on dark nav bar',
    fg: COLORS.white,
    bg: COLORS.darkGreyBrown,
    size: 'normal',
    where: 'nav a',
  },
  {
    name: 'Nav links on hover, on dark nav bar',
    fg: COLORS.goldenrod,
    bg: COLORS.darkGreyBrown,
    size: 'normal',
    where: 'nav a:hover',
  },
  {
    name: 'Hero h1 accent, on dark video overlay',
    fg: COLORS.goldenrod,
    bg: COLORS.darkGreyBrown,
    size: 'large',
    where: '.hero-section h1',
  },
  {
    name: 'Project-card "View Details" link, on white card',
    fg: COLORS.goldenrodDark,
    bg: COLORS.white,
    size: 'normal',
    where: '.project-card a',
  },
  {
    name: 'Project-card "View Details" link hover, on white card',
    fg: COLORS.mediumBrown,
    bg: COLORS.white,
    size: 'normal',
    where: '.project-card a:hover',
  },
  {
    name: 'Project-card title, on white card',
    fg: COLORS.mediumBrown,
    bg: COLORS.white,
    size: 'normal',
    where: '.project-card h3',
  },
  {
    name: 'Footer links/icons, on dark footer',
    fg: COLORS.goldenrod,
    bg: COLORS.darkGreyBrown,
    size: 'large', // rendered as text-2xl icons, not small body copy
    where: 'footer a',
  },
  {
    name: 'Tag pill text, on gold pill background',
    fg: COLORS.darkGreyBrown,
    bg: COLORS.goldenrod,
    size: 'normal',
    where: '.tag',
  },
  {
    name: 'Primary button text, on gold button (rest)',
    fg: COLORS.darkGreyBrown,
    bg: COLORS.goldenrod,
    size: 'normal',
    where: '.btn-primary',
  },
  {
    name: 'Primary button text, on brown button (hover)',
    fg: COLORS.white,
    bg: COLORS.mediumBrown,
    size: 'normal',
    where: '.btn-primary:hover',
  },
  {
    name: 'Section heading (h2), on white/off-white sections',
    fg: COLORS.darkBrownTaupe,
    bg: COLORS.white,
    size: 'large', // h2 is text-4xl/text-5xl, always well above 24px
    where: 'h2',
  },
];

// --- Focus ring: a:focus-visible / button:focus-visible in css/style.css ----
// Two-tone ring (white inner outline + dark-grey-brown outer box-shadow)
// instead of one color: the site alternates between light and dark
// sections, and no single palette color clears 3:1 against both. WCAG
// 1.4.11 only requires ONE part of a multi-part indicator to meet the
// minimum against whatever it's drawn over, so each background below only
// needs its ring MAX (not both individual rings) to clear AA_NON_TEXT.

const FOCUS_RING = {
  innerWhite: COLORS.white,
  outerDark: COLORS.darkGreyBrown,
};

const FOCUS_RING_BACKGROUNDS = [
  { name: 'white page background', bg: COLORS.white },
  { name: 'dark nav/footer background', bg: COLORS.darkGreyBrown },
  { name: 'gold button background', bg: COLORS.goldenrod },
  { name: 'light-gray card background', bg: COLORS.lightGray100 },
  { name: 'off-white section background', bg: COLORS.offWhiteSection },
];

// --- Run the checks ----------------------------------------------------------

let failures = 0;

for (const pair of PAIRS) {
  const ratio = contrastRatio(pair.fg, pair.bg);
  const threshold = pair.size === 'large' ? AA_LARGE : AA_NORMAL;
  const pass = ratio >= threshold;
  const status = pass ? 'PASS' : 'FAIL';
  if (!pass) failures += 1;
  console.log(
    `[${status}] ${ratio.toFixed(2)}:1 (needs ${threshold}:1, ${pair.size}) - ${pair.name} ` +
      `[${pair.where}] #${pair.fg} on #${pair.bg}`
  );
}

console.log('');

for (const { name, bg } of FOCUS_RING_BACKGROUNDS) {
  const innerRatio = contrastRatio(FOCUS_RING.innerWhite, bg);
  const outerRatio = contrastRatio(FOCUS_RING.outerDark, bg);
  const best = Math.max(innerRatio, outerRatio);
  const pass = best >= AA_NON_TEXT;
  const status = pass ? 'PASS' : 'FAIL';
  if (!pass) failures += 1;
  console.log(
    `[${status}] focus ring on ${name}: inner ${innerRatio.toFixed(2)}:1, outer ${outerRatio.toFixed(2)}:1 ` +
      `(best ${best.toFixed(2)}:1, needs ${AA_NON_TEXT}:1)`
  );
}

console.log('');
const totalChecks = PAIRS.length + FOCUS_RING_BACKGROUNDS.length;
if (failures > 0) {
  console.error(`${failures} of ${totalChecks} check(s) fail WCAG AA.`);
  process.exit(1);
} else {
  console.log(`All ${totalChecks} checks pass WCAG AA.`);
  process.exit(0);
}
