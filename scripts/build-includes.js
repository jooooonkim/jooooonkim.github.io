#!/usr/bin/env node
// Regenerates the <nav> and <footer> block of every page from the single
// source-of-truth partials in partials/nav.html and partials/footer.html.
//
// Run with `node scripts/build-includes.js` to apply, or with `--check` to
// verify every page already matches what the partials would produce (no
// writes; exits 1 and lists what's out of sync otherwise). `npm test` runs
// --check, so editing a partial without regenerating - or hand-editing a
// page's nav/footer directly - fails loudly instead of silently drifting
// the 8 pages out of sync with each other again.
//
// Why this exists: nav/footer markup used to be hand-duplicated, byte-for-
// byte (mostly - see below), across all 8 HTML pages, with no include
// mechanism. Any nav change had to be made 8 times by hand, and there was
// even a 9th, unused, already-stale copy sitting in navbar.html (removed
// separately). This keeps the deployed output exactly as plain static HTML
// - GitHub Pages needs zero special handling, no Jekyll, no Actions - while
// giving nav and footer one real file each to edit.
//
// Placeholders available inside partials/*.html:
//   __ROOT__  - relative path prefix to the site root ("" or "../../")
//   __HOME__  - href prefix before a "#fragment" link back to index.html:
//               "" when the page IS index.html (so links stay same-page
//               anchors like "#about"), or "<root>index.html" otherwise.
//
// Two pre-existing inconsistencies were standardized while extracting the
// partials (see the audit/refactor commit message for specifics): the
// logo link on sub-pages now includes a harmless "#home" fragment (was
// bare "index.html" on some pages - identical destination, since #home is
// the top of the page anyway), and every footer's copyright year span now
// carries the same static "2025" fallback text that only index.html had
// (all pages overwrite it via js/script.js on load regardless).

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const NAV_PARTIAL = fs.readFileSync(path.join(ROOT_DIR, 'partials', 'nav.html'), 'utf8');
const FOOTER_PARTIAL = fs.readFileSync(path.join(ROOT_DIR, 'partials', 'footer.html'), 'utf8');

const PAGES = [
  { file: 'index.html', root: '', home: true },
  { file: 'all-projects.html', root: '', home: false },
  { file: 'projects/air-piston/project-air-piston.html', root: '../../', home: false },
  { file: 'projects/curling/project-curling.html', root: '../../', home: false },
  { file: 'projects/drone-control/project-drone-control.html', root: '../../', home: false },
  { file: 'projects/drone-simulations/project-drone-simulations.html', root: '../../', home: false },
  { file: 'projects/ez-fold/project-ez-fold.html', root: '../../', home: false },
  { file: 'projects/gear-train/project-gear-train.html', root: '../../', home: false },
];

function render(partial, { root, home }) {
  const homePrefix = home ? '' : `${root}index.html`;
  return partial.split('__ROOT__').join(root).split('__HOME__').join(homePrefix).trim();
}

const NAV_RE = /<nav\b[\s\S]*?<\/nav>/;
const FOOTER_RE = /<footer\b[\s\S]*?<\/footer>/;

const checkMode = process.argv.includes('--check');
let drifted = 0;

for (const page of PAGES) {
  const fullPath = path.join(ROOT_DIR, page.file);
  const src = fs.readFileSync(fullPath, 'utf8');

  const navHtml = render(NAV_PARTIAL, page);
  const footerHtml = render(FOOTER_PARTIAL, page);

  if (!NAV_RE.test(src)) throw new Error(`${page.file}: no <nav>...</nav> block found`);
  if (!FOOTER_RE.test(src)) throw new Error(`${page.file}: no <footer>...</footer> block found`);

  const updated = src.replace(NAV_RE, navHtml).replace(FOOTER_RE, footerHtml);
  const inSync = updated === src;

  if (checkMode) {
    console.log(`${inSync ? 'ok   ' : 'DRIFT'}  ${page.file}`);
    if (!inSync) drifted++;
  } else if (!inSync) {
    fs.writeFileSync(fullPath, updated);
    console.log(`wrote  ${page.file}`);
  } else {
    console.log(`ok     ${page.file}  (unchanged)`);
  }
}

if (checkMode && drifted > 0) {
  console.error(`\n${drifted} page(s) out of sync with partials/. Run: node scripts/build-includes.js`);
  process.exit(1);
}
