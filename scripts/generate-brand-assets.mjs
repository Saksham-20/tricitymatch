#!/usr/bin/env node
/**
 * TricityMatch brand asset pipeline (P1.1 + E2).
 *
 * SINGLE SOURCE OF TRUTH for the "TM" monogram. Everything downstream —
 * frontend/public/images/logo.svg, frontend/public/favicon.svg, the favicon +
 * PWA icon PNGs, the OG share card, and mobile/assets/*.png — is generated from
 * the letterform paths in this file. Re-run after any change to the mark:
 *
 *     node scripts/generate-brand-assets.mjs
 *
 * Design notes
 * ------------
 * The mark is a serif "TM" monogram in cream (#FDF8F2) on the brand burgundy
 * (#8B2346). Letterforms are hand-authored PATHS, never <text>: an SVG loaded
 * through <img> is an isolated document and cannot see the page's webfonts, so
 * a text-based mark would silently fall back to Times on every surface.
 *
 * Three cuts (per plan P1.1):
 *   1. MARK    — refined Didone-ish letterforms with bracketed serifs. Used at
 *                40-96px beside the wordmark (Logo.jsx) and for the app icons.
 *   2. FAVICON — heavier stems, flat slab serifs, wider T/M gap, larger optical
 *                size. A two-letter refined serif monogram is mud at 16px.
 *   3. LOCKUP  — mark + Playfair wordmark, used only for the OG card (rendered
 *                server-side by sharp/librsvg where the real font IS available).
 *
 * Gold (#C9A227) is deliberately absent from the logo cuts — the design system
 * reserves gold for premium/VIP surfaces. It appears only on the OG card, which
 * is marketing collateral.
 */

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ── Brand tokens ─────────────────────────────────────────────────────────── */
const BURGUNDY = '#8B2346';
const BURGUNDY_DEEP = '#6B1D3A';
const CREAM = '#FDF8F2';
const GOLD = '#C9A227';
const GOLD_LIGHT = '#E8C34A'; // AA on burgundy (5.1:1); #C9A227 is only 3.4:1

/* ── Cut 1: refined mark ───────────────────────────────────────────────────
 * 256-unit grid. Letterforms occupy x 30..226, y 80..176 → optically centred
 * on (128,128). Thick verticals + hairline horizontals + bracketed serifs give
 * the Playfair/Didone voice without depending on a font being present.
 */
const MARK_PATHS = [
  // T — bar 30..106 with serif drops at both ends, stem 60..76, bracketed foot
  'M30 80 L106 80 L106 102 L98 102 Q98 94 90 94 L76 94 L76 152 Q76 170 92 172 ' +
    'L92 176 L44 176 L44 172 Q60 170 60 152 L60 94 L46 94 Q38 94 38 102 L30 102 Z',
  // M left stem (top slab serif + bracketed foot)
  'M118 80 L150 80 L150 88 L142 88 L142 152 Q142 168 158 172 L158 176 L110 176 ' +
    'L110 172 Q126 168 126 152 L126 88 L118 88 Z',
  // M vee — thick left diagonal / matching right diagonal, apex at (168,148)
  'M126 88 L142 88 L168 148 L194 88 L210 88 L172 176 L164 176 Z',
  // M right stem
  'M186 80 L218 80 L218 88 L210 88 L210 152 Q210 168 226 172 L226 176 L178 176 ' +
    'L178 172 Q194 168 194 152 L194 88 L186 88 Z',
];
const MARK_BOX = { x0: 30, x1: 226, y0: 80, y1: 176 };

/* ── Cut 2: favicon (heavy) ────────────────────────────────────────────────
 * Same 256-unit grid, letterforms at x 26..230, y 64..192 — 33% larger optical
 * size, 50% thicker stems, flat slab serifs, and an 18-unit T/M gap so the two
 * letters stay separate at 16px (≈1.4 device px of air).
 */
const FAVICON_PATHS = [
  // T — 22-unit stem, flat slab serifs
  'M26 64 L102 64 L102 94 L90 94 L90 84 L75 84 L75 172 L90 172 L90 192 L38 192 ' +
    'L38 172 L53 172 L53 84 L38 84 L38 94 L26 94 Z',
  // M left stem — 20 units, keeping the counters open enough to survive 16px
  'M120 64 L164 64 L164 76 L152 76 L152 180 L164 180 L164 192 L118 192 L118 180 ' +
    'L132 180 L132 76 L120 76 Z',
  // M vee — apex at (174,138); counters ~12 units wide at mid-height
  'M132 76 L152 76 L174 138 L196 76 L216 76 L179 180 L169 180 Z',
  // M right stem
  'M184 64 L228 64 L228 76 L216 76 L216 180 L230 180 L230 192 L184 192 L184 180 ' +
    'L196 180 L196 76 L184 76 Z',
];
const FAVICON_BOX = { x0: 26, x1: 230, y0: 64, y1: 192 };

/* ── SVG builders ─────────────────────────────────────────────────────────── */

/** Scale a path set about the 256-grid centre. */
function glyphGroup(paths, { scale = 1, fill = CREAM, dx = 0, dy = 0 } = {}) {
  const body = paths.map((d) => `    <path d="${d}" />`).join('\n');
  const t = `translate(${128 + dx} ${128 + dy}) scale(${scale}) translate(-128 -128)`;
  return `  <g fill="${fill}" transform="${t}">\n${body}\n  </g>`;
}

/**
 * @param {object} o
 * @param {'rounded'|'square'|'none'} o.field  burgundy plate style
 * @param {number} o.scale                     glyph scale about centre
 */
function buildSvg({ paths, field = 'rounded', scale = 1, glyphFill = CREAM, title }) {
  let plate = '';
  if (field === 'rounded') {
    plate = `  <rect width="256" height="256" rx="57" ry="57" fill="${BURGUNDY}" />`;
  } else if (field === 'square') {
    plate = `  <rect width="256" height="256" fill="${BURGUNDY}" />`;
  }
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img"' +
      ` aria-label="${title}">`,
    `  <title>${title}</title>`,
    plate,
    glyphGroup(paths, { scale, fill: glyphFill }),
    '</svg>',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Largest glyph scale that keeps the mark inside a maskable safe circle
 * (Android/PWA crop the outer 20%, so content must fit r = 0.4 * size).
 */
function maskableScale(box, safeRatio = 0.4) {
  const halfW = Math.max(128 - box.x0, box.x1 - 128);
  const halfH = Math.max(128 - box.y0, box.y1 - 128);
  const r = Math.hypot(halfW, halfH);
  return (safeRatio * 256) / r;
}

/* ── Rendered variants ────────────────────────────────────────────────────── */
const SVG = {
  // Web/app mark — rounded burgundy plate, 8.5% breathing room.
  logo: buildSvg({ paths: MARK_PATHS, field: 'rounded', scale: 1.08, title: 'TricityMatch' }),
  // Favicon — heavy cut, rounded plate.
  favicon: buildSvg({ paths: FAVICON_PATHS, field: 'rounded', scale: 1, title: 'TricityMatch' }),
  // Maskable / full-bleed app icon — square plate, glyphs inside the safe circle.
  maskable: buildSvg({
    paths: MARK_PATHS,
    field: 'square',
    scale: maskableScale(MARK_BOX),
    title: 'TricityMatch',
  }),
  // Android adaptive foreground — safe zone is the centre 66%.
  adaptive: buildSvg({
    paths: MARK_PATHS,
    field: 'square',
    scale: maskableScale(MARK_BOX, 0.33),
    title: 'TricityMatch',
  }),
  // Splash — glyphs only on transparency (Expo paints #8B2346 behind).
  splash: buildSvg({ paths: MARK_PATHS, field: 'none', scale: 1.08, title: 'TricityMatch' }),
};

/* ── OG share card (E2) ────────────────────────────────────────────────────
 * 1200x630. Rendered by librsvg where Playfair Display resolves from the
 * system, so the wordmark can be real text here. NO NUMBERS — the whole point
 * of the P0.1b truth pass.
 */
function ogCardSvg() {
  const markTile = [
    `  <g transform="translate(90 132) scale(0.5)">`,
    `    <rect width="256" height="256" rx="57" ry="57" fill="${CREAM}" />`,
    glyphGroup(MARK_PATHS, { scale: 1.08, fill: BURGUNDY })
      .split('\n')
      .map((l) => `  ${l}`)
      .join('\n'),
    `  </g>`,
  ].join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="field" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BURGUNDY}" />
      <stop offset="100%" stop-color="${BURGUNDY_DEEP}" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#field)" />
  <rect width="1200" height="7" fill="${GOLD}" />

${markTile}

  <text x="240" y="230" font-family="Playfair Display, Georgia, serif" font-size="78"
        font-weight="600" fill="${CREAM}" letter-spacing="-1">TricityMatch</text>

  <text x="90" y="378" font-family="Playfair Display, Georgia, serif" font-size="56"
        fill="${CREAM}">Tricity&#8217;s own matrimonial community</text>

  <rect x="90" y="440" width="112" height="3" fill="${GOLD}" />

  <text x="90" y="512" font-family="Inter, Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="30" font-weight="500" fill="${GOLD_LIGHT}" letter-spacing="2.5">FOUNDING MEMBERS JOIN FREE</text>

  <text x="90" y="566" font-family="Inter, Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="25" fill="${CREAM}" opacity="0.72">Chandigarh &#183; Mohali &#183; Panchkula</text>
</svg>
`;
}

/* ── Emit ─────────────────────────────────────────────────────────────────── */

const png = (svg, size, height) =>
  sharp(Buffer.from(svg)).resize(size, height ?? size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 });

async function out(path, buffer) {
  const full = resolve(ROOT, path);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, buffer);
  console.log('  ✓', path);
}

async function main() {
  console.log('TricityMatch brand assets\n');

  // 1. Source SVGs committed to the repo -----------------------------------
  console.log('SVG marks');
  await out('frontend/public/images/logo.svg', SVG.logo);
  await out('frontend/public/favicon.svg', SVG.favicon);
  await out('mobile/assets/logo.svg', SVG.logo);

  // 2. Favicon PNGs (heavy cut — never masked by the browser) ---------------
  console.log('\nFavicons');
  for (const size of [16, 32]) {
    await out(`frontend/public/icons/favicon-${size}x${size}.png`, await png(SVG.favicon, size).toBuffer());
  }

  // 3. PWA icons — manifest declares "maskable any", so full-bleed ----------
  console.log('\nPWA icons');
  for (const size of [72, 96, 128, 144, 152, 192, 384, 512]) {
    await out(`frontend/public/icons/icon-${size}x${size}.png`, await png(SVG.maskable, size).toBuffer());
  }
  await out('frontend/public/icons/manifest-icon-192.maskable.png', await png(SVG.maskable, 192).toBuffer());
  await out('frontend/public/icons/manifest-icon-512.maskable.png', await png(SVG.maskable, 512).toBuffer());

  // 4. Apple touch icons — iOS applies its own squircle mask ---------------
  console.log('\nApple touch icons');
  await out('frontend/public/icons/apple-touch-icon.png', await png(SVG.maskable, 180).toBuffer());
  await out('frontend/public/icons/apple-icon-180.png', await png(SVG.maskable, 180).toBuffer());

  // 5. OG share card -------------------------------------------------------
  console.log('\nSocial');
  await out(
    'frontend/public/images/og-card.png',
    await sharp(Buffer.from(ogCardSvg())).png({ compressionLevel: 9 }).toBuffer()
  );

  // 6. Mobile assets (assets only — bundle IDs / RN source untouched) -------
  console.log('\nMobile assets');
  await out('mobile/assets/logo.png', await png(SVG.logo, 512).toBuffer());
  await out('mobile/assets/icon.png', await png(SVG.maskable, 1024).toBuffer());
  await out('mobile/assets/adaptive-icon.png', await png(SVG.adaptive, 1024).toBuffer());
  await out('mobile/assets/splash.png', await png(SVG.splash, 1200).toBuffer());
  await out('mobile/assets/favicon.png', await png(SVG.favicon, 48).toBuffer());

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
