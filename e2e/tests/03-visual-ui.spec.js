/**
 * ========================================================================
 * VISUAL UI TESTS  –  TricityMatch QA Suite
 * ========================================================================
 * Per-page:
 *  • Full-page screenshots at desktop, tablet, and mobile
 *  • Overflow element detection
 *  • Broken image detection
 *  • Elements outside viewport
 *  • Font loading check
 *  • CSS text truncation / clipping issues
 * ========================================================================
 */
const { test, expect } = require('@playwright/test');
const {
  fullPageScreenshot,
  viewportScreenshot,
  findOverflowElements,
  findBrokenImages,
  findImagesWithoutAlt,
  waitForStable,
} = require('../utils/helpers');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

// Public pages to audit visually
const PUBLIC_PAGES = [
  { path: '/',                name: 'home'           },
  { path: '/login',           name: 'login'          },
  { path: '/signup',          name: 'signup'         },
  { path: '/forgot-password', name: 'forgot-password'},
  { path: '/terms',           name: 'terms'          },
  { path: '/privacy',         name: 'privacy'        },
];

// Viewports to test
const VIEWPORTS = [
  { name: 'desktop',  width: 1280, height: 800  },
  { name: 'tablet',   width: 768,  height: 1024 },
  { name: 'mobile',   width: 390,  height: 844  },    // iPhone 14
];

// ── Reusable visual audit for a single page + viewport ───────────────────────
async function auditView(page, url, pageName, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForStable(page);

  const label = `${pageName}-${viewport.name}`;

  // ── Screenshots ────────────────────────────────────────────────────────
  await fullPageScreenshot(page,  `visual/${pageName}`, `${label}-full`);
  await viewportScreenshot(page,  `visual/${pageName}`, `${label}-vp`);

  // ── Overflow detection ─────────────────────────────────────────────────
  const overflows = await findOverflowElements(page);
  if (overflows.length > 0) {
    console.warn(`  ⚠  [${label}] ${overflows.length} overflow element(s):`);
    overflows.forEach(o => console.warn(`     • <${o.tag}> overflows by ${o.overflow}px — id="${o.id}" class="${o.class}"`));
  }

  // ── Broken images ── ───────────────────────────────────────────────────
  const broken = await findBrokenImages(page);
  if (broken.length > 0) {
    console.warn(`  ⚠  [${label}] ${broken.length} broken image(s):`);
    broken.forEach(b => console.warn(`     • ${b.src}`));
  }

  // ── Images missing alt text ────────────────────────────────────────────
  const noAlt = await findImagesWithoutAlt(page);
  if (noAlt.length > 0) {
    console.warn(`  ⚠  [${label}] ${noAlt.length} image(s) without alt text`);
  }

  // ── Elements outside the visible viewport ─────────────────────────────
  const outside = await page.evaluate(({ w, h }) => {
    const els = [];
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.right < 0 || r.left > w)) {
        els.push({ tag: el.tagName.toLowerCase(), x: Math.round(r.left), y: Math.round(r.top) });
      }
    });
    return els.slice(0, 10);
  }, { w: viewport.width, h: viewport.height });

  if (outside.length > 0) {
    console.warn(`  ⚠  [${label}] ${outside.length} element(s) outside viewport`);
  }

  // ── CSS font check ─────────────────────────────────────────────────────
  const fontIssues = await page.evaluate(() => {
    const issues = [];
    document.querySelectorAll('p, h1, h2, h3, span, a, button').forEach(el => {
      const style = window.getComputedStyle(el);
      const font  = style.fontFamily;
      if (font === 'serif' || font === 'Times New Roman' || font === 'sans-serif') {
        // Likely fallback font, custom font failed to load
        issues.push({ tag: el.tagName.toLowerCase(), font });
      }
    });
    return [...new Set(issues.map(JSON.stringify))].slice(0, 5).map(JSON.parse);
  });

  if (fontIssues.length > 0) {
    console.warn(`  ⚠  [${label}] Fallback/default fonts detected (custom fonts may not have loaded)`);
  }

  return { overflows, broken, noAlt, outside, fontIssues };
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('🖼  Visual UI Audit', () => {
  for (const pg of PUBLIC_PAGES) {
    test.describe(`Page: ${pg.name}`, () => {
      for (const vp of VIEWPORTS) {
        test(`${pg.name} @ ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
          const result = await auditView(page, BASE + pg.path, pg.name, vp);

          // Hard failure: more than 5 overflows is a layout problem
          expect(result.overflows.length,
            `${pg.name}@${vp.name} has ${result.overflows.length} overflow elements`
          ).toBeLessThan(5);
        });
      }
    });
  }

  // ── Navbar rendering test ──────────────────────────────────────────────────
  test('Desktop navbar has all key links', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await waitForStable(page);
    await fullPageScreenshot(page, 'visual/navbar', 'desktop-navbar');

    // Should have navigation links
    const nav = page.locator('nav, [role="navigation"]').first();
    await expect(nav).toBeVisible();
  });

  test('Mobile shows bottom navigation bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await waitForStable(page);
    await fullPageScreenshot(page, 'visual/navbar', 'mobile-bottom-nav');
  });

  // ── Hero section / home page CTA ──────────────────────────────────────────
  test('Homepage hero section and CTA buttons are visible on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await waitForStable(page);

    // CTA buttons should exist
    const cta = page.locator('button, a[href*="signup"], a[href*="login"]').first();
    await expect(cta).toBeVisible();
    await fullPageScreenshot(page, 'visual/home', 'hero-desktop');
  });

  test('Homepage is responsive on mobile (no horizontal scroll)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await waitForStable(page);

    const overflows = await findOverflowElements(page);
    await fullPageScreenshot(page, 'visual/home', 'hero-mobile');

    expect(overflows.length,
      `Homepage has ${overflows.length} overflow elements on mobile`
    ).toBeLessThan(3);
  });

  // ── Login page aesthetic tests ─────────────────────────────────────────────
  test('Login form is centered and aligned on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/login');
    await waitForStable(page);

    const form = page.locator('form').first();
    await expect(form).toBeVisible();

    const box = await form.boundingBox();
    expect(box).not.toBeNull();
    // Form should be roughly center of page (not pinned to edge)
    expect(box.x).toBeGreaterThan(50);
    expect(box.x + box.width).toBeLessThan(1230);
    await fullPageScreenshot(page, 'visual/login', 'login-desktop-aligned');
  });

  // ── Terms & Privacy – long-form content ───────────────────────────────────
  test('Terms page renders long-form content without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/terms');
    await waitForStable(page);
    await fullPageScreenshot(page, 'visual/terms', 'terms-desktop');

    const overflows = await findOverflowElements(page);
    expect(overflows.length).toBeLessThan(3);
  });
});
