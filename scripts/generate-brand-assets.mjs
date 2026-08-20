#!/usr/bin/env node
/**
 * TricityMatch brand asset pipeline.
 *
 * SINGLE SOURCE OF TRUTH for the "TM" monogram. Everything downstream —
 * frontend/public/images/logo.svg, frontend/public/favicon.svg, the favicon +
 * PWA icon PNGs, the OG share card, and mobile/assets/*.png — is generated from
 * the letterform geometry in this file. Re-run after any change to the mark:
 *
 *     node scripts/generate-brand-assets.mjs
 *
 * Design notes
 * ------------
 * The mark is a serif "TM" monogram in white on the logo red (#B30021),
 * traced from the master Illustrator artwork ("final TM.svg", 1000x1000).
 * Letterforms are POLYGONS, never <text>: an SVG loaded through <img> is an
 * isolated document and cannot see the page's webfonts, so a text-based mark
 * would silently fall back to Times on every surface.
 *
 * The logo red (#B30021) is the mark's OWN colour and is intentionally distinct
 * from the UI brand burgundy (#8B2346) that the design system still uses for
 * buttons, headers and premium surfaces. Do not swap one for the other.
 *
 * Cuts:
 *   1. LOGO     — the artwork as drawn. Web/app mark; callers apply their own
 *                 corner rounding (Logo.jsx `rounded-lg`, Logo.tsx borderRadius).
 *   2. FAVICON  — glyphs enlarged to ~90% of the plate. A serif monogram set at
 *                 the artwork's default 78% is mud at 16px.
 *   3. MASKABLE — glyphs pulled inside the maskable safe circle (outer 20% of a
 *                 PWA/Android icon is croppable).
 *   4. ADAPTIVE — Android adaptive foreground; safe zone is the centre 66%.
 *   5. SPLASH   — glyphs only on transparency (Expo paints the red behind).
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
const RED = '#B30021'; // the logo's own red, from the master artwork
const WHITE = '#FFFFFF';
const BURGUNDY = '#8B2346'; // UI brand colour — OG card field only
const BURGUNDY_DEEP = '#6B1D3A';
const CREAM = '#FDF8F2';
const GOLD = '#C9A227';
const GOLD_LIGHT = '#E8C34A'; // AA on burgundy (5.1:1); #C9A227 is only 3.4:1

/* ── The mark ──────────────────────────────────────────────────────────────
 * 1000-unit grid, traced verbatim from the master artwork. The two glyphs are
 * optically centred on (500,500): bbox x 110.4..889.6, y 251.64..748.36, so the
 * mark occupies 77.9% of the plate width and 49.7% of its height.
 */
const GLYPHS = [
  // glyph A — the M with its swash entry stroke
  `396.44 385.76 396.44 395.26 404.75 395.85 414.84 398.82 423.74 404.16 432.05 412.47 ` +
    `441.55 429.08 446.29 447.48 447.48 485.46 445.11 505.64 437.98 532.94 421.96 573.88 ` +
    `414.25 598.22 409.5 623.14 408.91 643.91 413.06 672.4 420.18 692.57 432.05 712.16 ` +
    `449.26 728.77 465.88 738.27 478.34 742.42 498.52 745.39 529.38 744.8 529.38 735.3 ` +
    `513.95 734.12 496.14 729.37 478.93 721.65 464.1 711.56 453.41 700.88 445.11 689.01 ` +
    `437.98 674.18 433.83 659.93 432.05 648.66 431.46 628.48 434.42 602.96 441.55 573.88 ` +
    `456.38 527.6 462.91 494.96 463.5 461.13 461.13 439.76 463.5 442.73 600.59 745.39 ` +
    `649.25 745.39 764.98 474.78 782.19 437.39 782.78 706.22 781 715.72 775.66 728.77 ` +
    `761.41 737.68 752.51 740.05 742.42 740.64 743.02 748.36 889.01 748.36 889.01 740.64 ` +
    `870.61 738.27 856.96 730.56 851.62 721.65 848.06 708.6 847.46 437.39 850.43 422.55 ` +
    `856.96 410.09 863.49 403.56 871.8 398.82 881.89 395.85 889.6 395.26 889.6 385.76 ` +
    `782.78 385.76 646.88 701.48 643.32 696.73 502.08 385.76 396.44 385.76`,
  // glyph B — the T
  `125.83 251.64 110.4 311.58 112.77 312.17 119.3 311.58 127.02 300.3 166.78 280.13 ` +
    `185.17 273.6 198.23 271.23 227.9 270.04 300.9 270.63 300.3 678.93 299.12 699.7 ` +
    `296.15 712.16 289.62 724.62 271.23 732.34 249.27 734.71 249.86 743.02 417.81 743.02 ` +
    `418.4 735.3 398.82 733.52 388.13 731.15 373.3 722.25 366.18 705.63 363.21 691.98 ` +
    `362.62 270.63 444.51 271.23 471.22 273.6 493.18 277.75 512.17 283.69 527.6 292 ` +
    `539.46 302.68 544.81 311.58 547.18 312.77 553.71 310.99 538.87 252.23 125.83 251.64`,
];

const GRID = 1000;
const GLYPH_BOX = { x0: 110.4, x1: 889.6, y0: 251.64, y1: 748.36 };

/* ── SVG builders ─────────────────────────────────────────────────────────── */

/** Scale the glyph set about the plate centre. */
function glyphGroup({ scale = 1, fill = WHITE } = {}) {
  const body = GLYPHS.map((points) => `    <polygon points="${points}" />`).join('\n');
  const c = GRID / 2;
  const t = `translate(${c} ${c}) scale(${scale}) translate(${-c} ${-c})`;
  return `  <g fill="${fill}" transform="${t}">\n${body}\n  </g>`;
}

/**
 * @param {object} o
 * @param {'square'|'none'} o.field  red plate, or glyphs on transparency
 * @param {number} o.scale           glyph scale about centre
 */
function buildSvg({ field = 'square', scale = 1, glyphFill = WHITE, plateFill = RED, title }) {
  const plate =
    field === 'square' ? `  <rect width="${GRID}" height="${GRID}" fill="${plateFill}" />` : '';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" width="${GRID}"` +
      ` height="${GRID}" role="img" aria-label="${title}">`,
    `  <title>${title}</title>`,
    plate,
    glyphGroup({ scale, fill: glyphFill }),
    '</svg>',
    '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Largest glyph scale whose bbox still fits a centred safe circle of r = ratio * GRID. */
function safeCircleScale(ratio) {
  const halfW = Math.max(GRID / 2 - GLYPH_BOX.x0, GLYPH_BOX.x1 - GRID / 2);
  const halfH = Math.max(GRID / 2 - GLYPH_BOX.y0, GLYPH_BOX.y1 - GRID / 2);
  return (ratio * GRID) / Math.hypot(halfW, halfH);
}

/** Glyph scale that makes the mark span `ratio` of the plate width. */
function widthScale(ratio) {
  return (ratio * GRID) / (GLYPH_BOX.x1 - GLYPH_BOX.x0);
}

/* ── Rendered variants ────────────────────────────────────────────────────── */
const SVG = {
  // Web/app mark — the artwork as drawn. Callers round the corners themselves.
  logo: buildSvg({ title: 'TricityMatch' }),
  // Favicon — glyphs pushed out to 90% width so the serif survives 16px.
  favicon: buildSvg({ scale: widthScale(0.9), title: 'TricityMatch' }),
  // Maskable / full-bleed app icon — outer 20% is croppable.
  maskable: buildSvg({ scale: safeCircleScale(0.4), title: 'TricityMatch' }),
  // Android adaptive foreground — safe zone is the centre 66%.
  adaptive: buildSvg({ scale: safeCircleScale(0.33), title: 'TricityMatch' }),
  // Splash — glyphs only on transparency (Expo paints #B30021 behind).
  splash: buildSvg({ field: 'none', title: 'TricityMatch' }),
};

/** Android round launcher icon: red disc, glyphs inside the inscribed safe area. */
function roundSvg() {
  const c = GRID / 2;
  const s = safeCircleScale(0.4);
  const body = GLYPHS.map((points) => `    <polygon points="${points}" />`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" width="${GRID}" height="${GRID}" role="img" aria-label="TricityMatch">
  <title>TricityMatch</title>
  <circle cx="${c}" cy="${c}" r="${c}" fill="${RED}" />
  <g fill="${WHITE}" transform="translate(${c} ${c}) scale(${s}) translate(${-c} ${-c})">
${body}
  </g>
</svg>
`;
}

/** Full-screen iOS PWA startup image: mark centred on the red field. */
function appleSplashSvg(w, h) {
  const markWidth = 0.6 * Math.min(w, h);
  const s = markWidth / (GLYPH_BOX.x1 - GLYPH_BOX.x0);
  const tx = w / 2 - s * (GRID / 2);
  const ty = h / 2 - s * (GRID / 2);
  const body = GLYPHS.map((points) => `    <polygon points="${points}" />`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${RED}" />
  <g fill="${WHITE}" transform="translate(${tx} ${ty}) scale(${s})">
${body}
  </g>
</svg>
`;
}

/* The 40 sizes Apple's launch-image matrix covers, as `${width}-${height}`. */
const APPLE_SPLASH_SIZES = [
  '640-1136', '750-1334', '828-1792', '1125-2436', '1136-640', '1170-2532',
  '1179-2556', '1206-2622', '1242-2208', '1242-2688', '1260-2736', '1284-2778',
  '1290-2796', '1320-2868', '1334-750', '1488-2266', '1536-2048', '1620-2160',
  '1640-2360', '1668-2224', '1668-2388', '1792-828', '2048-1536', '2048-2732',
  '2160-1620', '2208-1242', '2224-1668', '2266-1488', '2360-1640', '2388-1668',
  '2436-1125', '2532-1170', '2556-1179', '2622-1206', '2688-1242', '2732-2048',
  '2736-1260', '2778-1284', '2796-1290', '2868-1320',
];

/* ── OG share card ─────────────────────────────────────────────────────────
 * 1200x630. Rendered by librsvg where Playfair Display resolves from the
 * system, so the wordmark can be real text here. NO NUMBERS — the whole point
 * of the truth pass. The field stays UI burgundy; the logo sits on a white
 * tile because red-on-burgundy has no contrast.
 */
function ogCardSvg() {
  const TILE = 128;
  const markTile = [
    `  <g transform="translate(90 132) scale(${TILE / GRID})">`,
    `    <rect width="${GRID}" height="${GRID}" rx="223" ry="223" fill="${WHITE}" />`,
    glyphGroup({ fill: RED })
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

/** Xcode .colorset Contents.json for a hex colour. */
function colorsetJson(hex) {
  const f = (i) => (parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255).toFixed(15);
  return `${JSON.stringify(
    {
      colors: [
        {
          color: {
            components: { alpha: '1.000', blue: f(2), green: f(1), red: f(0) },
            'color-space': 'srgb',
          },
          idiom: 'universal',
        },
      ],
      info: { version: 1, author: 'expo' },
    },
    null,
    2
  )}\n`;
}

/* ── Emit ─────────────────────────────────────────────────────────────────── */

const png = (svg, size, height) =>
  sharp(Buffer.from(svg))
    .resize(size, height ?? size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 });

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

  // 2. Favicon PNGs (enlarged cut — never masked by the browser) ------------
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

  // 5. iOS PWA startup images ---------------------------------------------
  // NOTE: nothing currently links these (no <link rel="apple-touch-startup-image">
  // in index.html and no manifest entry) — they ship as dead weight. Kept in
  // brand so they are correct if/when they get wired up.
  console.log('\niOS startup images');
  for (const size of APPLE_SPLASH_SIZES) {
    const [w, h] = size.split('-').map(Number);
    await out(
      `frontend/public/icons/apple-splash-${size}.jpg`,
      await sharp(Buffer.from(appleSplashSvg(w, h))).jpeg({ quality: 86, mozjpeg: true }).toBuffer()
    );
  }

  // 6. OG share card -------------------------------------------------------
  console.log('\nSocial');
  await out(
    'frontend/public/images/og-card.png',
    await sharp(Buffer.from(ogCardSvg())).png({ compressionLevel: 9 }).toBuffer()
  );

  // 7. Mobile assets (assets only — bundle IDs / RN source untouched) -------
  console.log('\nMobile assets');
  await out('mobile/assets/logo.png', await png(SVG.logo, 512).toBuffer());
  await out('mobile/assets/icon.png', await png(SVG.maskable, 1024).toBuffer());
  await out('mobile/assets/adaptive-icon.png', await png(SVG.adaptive, 1024).toBuffer());
  await out('mobile/assets/splash.png', await png(SVG.splash, 1200).toBuffer());
  await out('mobile/assets/favicon.png', await png(SVG.favicon, 48).toBuffer());


  // 8. Committed native projects -------------------------------------------
  // `mobile/ios` and `mobile/android` are checked in (bare workflow), so they
  // hold their own baked copies of the icon. Writing them here keeps the app
  // icon correct WITHOUT a full `expo prebuild`, which would churn native
  // config right before a store build. Re-run prebuild and these are simply
  // regenerated from app.json to the same result.
  console.log('\nNative — Android');
  // Expo writes PNG bytes under a .webp extension; Android reads by content.
  const ANDROID_DPI = [
    ['mdpi', 48, 108, 288],
    ['hdpi', 72, 162, 432],
    ['xhdpi', 96, 216, 576],
    ['xxhdpi', 144, 324, 864],
    ['xxxhdpi', 192, 432, 1152],
  ];
  const roundSvgStr = roundSvg();
  for (const [dpi, launcher, foreground, splash] of ANDROID_DPI) {
    const res = `mobile/android/app/src/main/res`;
    await out(`${res}/mipmap-${dpi}/ic_launcher.webp`, await png(SVG.maskable, launcher).toBuffer());
    await out(`${res}/mipmap-${dpi}/ic_launcher_round.webp`, await png(roundSvgStr, launcher).toBuffer());
    await out(`${res}/mipmap-${dpi}/ic_launcher_foreground.webp`, await png(SVG.adaptive, foreground).toBuffer());
    await out(`${res}/drawable-${dpi}/splashscreen_logo.png`, await png(SVG.splash, splash).toBuffer());
  }

  console.log('\nNative — iOS');
  const XC = 'mobile/ios/TricityMatch/Images.xcassets';
  // App Store rejects an alpha channel on the marketing icon — flatten it.
  await out(
    `${XC}/AppIcon.appiconset/App-Icon-1024x1024@1x.png`,
    await sharp(Buffer.from(SVG.maskable)).resize(1024, 1024).flatten({ background: RED }).png({ compressionLevel: 9 }).toBuffer()
  );
  for (const name of ['image.png', 'image@2x.png', 'image@3x.png']) {
    await out(`${XC}/SplashScreenLogo.imageset/${name}`, await png(SVG.splash, 1200).toBuffer());
  }
  await out(
    `${XC}/SplashScreenBackground.colorset/Contents.json`,
    Buffer.from(colorsetJson(RED))
  );

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
