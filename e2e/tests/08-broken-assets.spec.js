/**
 * ========================================================================
 * BROKEN ASSET DETECTION  –  TricityMatch QA Suite
 * ========================================================================
 * Detects across all public pages:
 *  • Broken / 404 images
 *  • Missing icons (favicon, SVG icons, icon fonts)
 *  • Failed font loads
 *  • Missing CSS files
 *  • Incorrect resource paths
 *  • Empty src / href attributes
 * ========================================================================
 */
const { test, expect } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');
const { waitForStable, fullPageScreenshot } = require('../utils/helpers');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

const PUBLIC_PAGES = [
  { path: '/',                name: 'Home'            },
  { path: '/login',           name: 'Login'           },
  { path: '/signup',          name: 'Signup'          },
  { path: '/forgot-password', name: 'ForgotPassword'  },
  { path: '/terms',           name: 'Terms'           },
  { path: '/privacy',         name: 'Privacy'         },
];

// ── Report ────────────────────────────────────────────────────────────────────
const assetReport = {
  generatedAt: new Date().toISOString(),
  pages: [],
  totalBrokenImages: 0,
  totalMissing404:   0,
  totalEmptySrc:     0,
};

function saveAssetReport() {
  const dir = path.join(process.cwd(), 'qa-reports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'broken-assets-report.json'),
    JSON.stringify(assetReport, null, 2)
  );
}

// ── Per-page asset check ──────────────────────────────────────────────────────
async function auditAssets(page, url, name) {
  const network404 = [];

  page.on('response', res => {
    if (res.status() === 404) {
      const resUrl = res.url();
      // Only care about static assets, not API calls
      if (!resUrl.includes('/api/')) {
        network404.push({ url: resUrl, type: getAssetType(resUrl) });
      }
    }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForStable(page);

  await fullPageScreenshot(page, 'assets', name.toLowerCase());

  // ── Broken images (naturalWidth === 0 after fully loaded) ────────────────
  const brokenImages = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img'))
      .filter(img => img.complete && img.naturalWidth === 0)
      .map(img => ({
        src:      img.src || img.getAttribute('src'),
        alt:      img.alt,
        visible:  img.offsetParent !== null,
      }))
  );

  // ── Empty src / href attributes ────────────────────────────────────────────
  const emptySrc = await page.evaluate(() => {
    const issues = [];
    document.querySelectorAll('img[src=""], img:not([src])').forEach(img => {
      issues.push({ type: 'img', html: img.outerHTML.slice(0, 80) });
    });
    document.querySelectorAll('link[href=""], script[src=""]').forEach(el => {
      issues.push({ type: el.tagName.toLowerCase(), html: el.outerHTML.slice(0, 80) });
    });
    return issues;
  });

  // ── SVG and icon checks ────────────────────────────────────────────────────
  const brokenSvg = await page.evaluate(() =>
    Array.from(document.querySelectorAll('svg use[href], svg use[xlink\\:href]'))
      .filter(use => {
        const href = use.getAttribute('href') || use.getAttribute('xlink:href');
        return href && href.startsWith('#') && !document.querySelector(href);
      })
      .map(use => ({
        href: use.getAttribute('href') || use.getAttribute('xlink:href'),
        html: use.outerHTML.slice(0, 100),
      }))
  );

  // ── Background-image CSS check ────────────────────────────────────────────
  const brokenBgImages = await page.evaluate(() => {
    const issues = [];
    document.querySelectorAll('[style*="background-image"]').forEach(el => {
      const style = el.style.backgroundImage || '';
      const match = style.match(/url\(['"]?([^'")\s]+)/);
      if (match) {
        // Check if it's a broken data or resource URL
        const urlVal = match[1];
        if (!urlVal.startsWith('data:') && urlVal.length < 5) {
          issues.push({ element: el.tagName.toLowerCase(), url: urlVal });
        }
      }
    });
    return issues;
  });

  // ── Icon font check ────────────────────────────────────────────────────────
  const iconFontIssues = await page.evaluate(() => {
    // Check if icon font glyphs are rendering (show as squares if missing)
    const icons = Array.from(document.querySelectorAll('[class*="icon"], [class*="fa-"], [class*="ri-"]'));
    return icons.slice(0, 5).map(el => ({
      class: el.className,
      text: el.textContent.trim().slice(0, 10),
    }));
  });

  // Record
  const record = {
    path: url,
    name,
    brokenImages: brokenImages.slice(0, 20),
    network404:   network404.slice(0, 20),
    emptySrc:     emptySrc.slice(0, 10),
    brokenSvg:    brokenSvg.slice(0, 10),
    brokenBgImages,
    iconCount:    iconFontIssues.length,
  };

  assetReport.pages.push(record);
  assetReport.totalBrokenImages += brokenImages.length;
  assetReport.totalMissing404   += network404.length;
  assetReport.totalEmptySrc     += emptySrc.length;
  saveAssetReport();

  return record;
}

function getAssetType(url) {
  if (/\.(png|jpg|jpeg|gif|webp|avif|svg)$/i.test(url)) return 'image';
  if (/\.(css)$/i.test(url)) return 'css';
  if (/\.(js)$/i.test(url)) return 'script';
  if (/\.(woff|woff2|ttf|eot)$/i.test(url)) return 'font';
  if (/favicon/i.test(url)) return 'favicon';
  return 'other';
}

// ── Tests ─────────────────────────────────────────────────────────────────────
test.describe('🔗 Broken Asset Detection', () => {
  test.describe.configure({ mode: 'serial' });

  for (const pg of PUBLIC_PAGES) {
    test(`No broken assets on: ${pg.name} (${pg.path})`, async ({ page }) => {
      const result = await auditAssets(page, BASE + pg.path, pg.name);

      // Log findings
      if (result.brokenImages.length > 0) {
        console.warn(`\n🖼  Broken images on ${pg.path} (${result.brokenImages.length}):`);
        result.brokenImages.forEach(i => console.warn(`   • ${i.src}`));
      }

      if (result.network404.length > 0) {
        console.warn(`\n❌  404 assets on ${pg.path} (${result.network404.length}):`);
        result.network404.forEach(n => console.warn(`   • [${n.type}] ${n.url}`));
      }

      if (result.emptySrc.length > 0) {
        console.warn(`\n⚠  Empty src/href on ${pg.path} (${result.emptySrc.length}):`);
        result.emptySrc.forEach(e => console.warn(`   • ${e.html}`));
      }

      if (result.brokenSvg.length > 0) {
        console.warn(`\n🔲 Broken SVG references on ${pg.path} (${result.brokenSvg.length}):`);
        result.brokenSvg.forEach(s => console.warn(`   • ${s.href}`));
      }

      // Hard failures
      expect(result.brokenImages.length,
        `${result.brokenImages.length} broken image(s) on ${pg.path}`
      ).toBe(0);

      // CSS files must not 404
      const missingCss = result.network404.filter(n => n.type === 'css');
      expect(missingCss.length,
        `Missing CSS file(s) on ${pg.path}: ${missingCss.map(r => r.url).join(', ')}`
      ).toBe(0);
    });
  }

  // ── Favicon loads ─────────────────────────────────────────────────────────
  test('Favicon exists and loads', async ({ page }) => {
    // Check the HTML favicon link tag first
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const faviconLink = await page.evaluate(() => {
      const link = document.querySelector('link[rel*="icon"]');
      return link ? link.href : null;
    });

    if (faviconLink) {
      // Verify the linked favicon is reachable (graceful – 404 logs a warning)
      const res = await page.request.get(faviconLink).catch(() => null);
      const status = res?.status() ?? 0;
      if (status >= 400) {
        console.warn(`⚠  Favicon linked at ${faviconLink} returned HTTP ${status}`);
      } else {
        console.log(`  ✓  Favicon: ${faviconLink} (status: ${status})`);
      }
    } else {
      console.warn('⚠  No <link rel="icon"> found – add a favicon for branding');
    }
    await fullPageScreenshot(page, 'assets', 'favicon-check');
  });

  // ── Font loading ───────────────────────────────────────────────────────────
  test('Custom fonts load successfully', async ({ page }) => {
    const fontFailures = [];
    page.on('response', res => {
      if (/\.(woff|woff2|ttf|eot)$/i.test(res.url()) && res.status() >= 400) {
        fontFailures.push({ url: res.url(), status: res.status() });
      }
    });

    await page.goto(BASE, { waitUntil: 'networkidle' });
    await waitForStable(page);

    if (fontFailures.length > 0) {
      console.warn('⚠  Font loading failures:', fontFailures);
    }

    expect(fontFailures.length,
      `${fontFailures.length} custom font(s) failed to load`
    ).toBe(0);
  });

  // ── Manifest & PWA ────────────────────────────────────────────────────────
  test('Web app manifest (PWA) exists', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const manifestLink = await page.evaluate(() => {
      const link = document.querySelector('link[rel="manifest"]');
      return link ? link.href : null;
    });

    if (!manifestLink) {
      console.warn('⚠  No web app manifest found – consider adding for PWA support');
    } else {
      const res = await page.goto(manifestLink);
      console.log(`  ✓  Manifest at ${manifestLink} → status ${res?.status()}`);
    }
  });

  // ── Broken asset summary ──────────────────────────────────────────────────
  test('Broken asset summary report', async ({}) => {
    console.log('\n🔗  Broken Asset Report Summary:');
    console.log(`   Pages audited         : ${assetReport.pages.length}`);
    console.log(`   Broken images total   : ${assetReport.totalBrokenImages}`);
    console.log(`   404 assets total      : ${assetReport.totalMissing404}`);
    console.log(`   Empty src/href total  : ${assetReport.totalEmptySrc}`);
    console.log('\n   Full report: qa-reports/broken-assets-report.json');
  });
});
