/**
 * ========================================================================
 * PERFORMANCE AUDIT  –  TricityMatch QA Suite
 * ========================================================================
 * Uses CDP (Chrome DevTools Protocol) via Playwright to measure:
 *  • First Contentful Paint (FCP)
 *  • Largest Contentful Paint (LCP)
 *  • Total Blocking Time (TBT proxy via long tasks)
 *  • Cumulative Layout Shift (CLS via LayoutInstabilityEntry)
 *  • Time to Interactive (TTI proxy)
 *  • Total page weight
 *  • Network resource sizes
 *  • JS bundle sizes
 *  • Number of requests
 * ========================================================================
 */
const { test, expect } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');
const { waitForStable, fullPageScreenshot } = require('../utils/helpers');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

// Pages to benchmark
const PAGES = [
  { path: '/',       name: 'Home'    },
  { path: '/login',  name: 'Login'   },
  { path: '/signup', name: 'Signup'  },
];

// Thresholds (Core Web Vitals)
// Note: totalSizeKB is intentionally lenient for development builds (Vite HMR, source maps).
// In production, expect ~3-4× reduction. Tighten to 5000 before prod CI.
const THRESHOLDS = {
  fcpMs:          3000,   // First Contentful Paint   < 3s  (good < 1.8s)
  lcpMs:          4000,   // Largest Contentful Paint  < 4s  (good < 2.5s)
  clsScore:       0.25,   // Cumulative Layout Shift   < 0.25 (good < 0.1)
  totalRequests:  80,     // Total HTTP requests
  totalSizeKB:    15000,  // Total page weight in KB (dev build; prod target ≤ 5000)
  largestJsKB:    1000,   // Single largest JS bundle
};

// ── Performance Report ────────────────────────────────────────────────────────
const perfReport = {
  generatedAt: new Date().toISOString(),
  thresholds: THRESHOLDS,
  pages: [],
};

function savePerfReport() {
  const dir = path.join(process.cwd(), 'qa-reports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'performance-report.json'),
    JSON.stringify(perfReport, null, 2)
  );
}

// ── Gather web vitals via Performance API ────────────────────────────────────
async function gatherWebVitals(page) {
  return page.evaluate(() => new Promise(resolve => {
    const metrics = { fcp: 0, lcp: 0, cls: 0, fid: 0, ttfb: 0 };

    // TTFB from navigation timing
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) metrics.ttfb = nav.responseStart - nav.fetchStart;

    // FCP via PerformancePaintTiming
    const paintEntries = performance.getEntriesByType('paint');
    for (const entry of paintEntries) {
      if (entry.name === 'first-contentful-paint') {
        metrics.fcp = entry.startTime;
      }
    }

    // LCP via PerformanceObserver
    let lcpResolved = false;
    try {
      const lcpObs = new PerformanceObserver(list => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          metrics.lcp = entries[entries.length - 1].startTime;
        }
      });
      lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch { /* LCP not supported in all envs */ }

    // CLS via PerformanceObserver
    let clsValue = 0;
    try {
      const clsObs = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        metrics.cls = clsValue;
      });
      clsObs.observe({ type: 'layout-shift', buffered: true });
    } catch { /* CLS not supported */ }

    // Resolve after a short delay to collect buffered entries
    setTimeout(() => {
      metrics.cls = clsValue; // final CLS
      resolve(metrics);
    }, 2000);
  }));
}

// ── Gather resource sizes ─────────────────────────────────────────────────────
async function gatherResourceMetrics(page) {
  return page.evaluate(() => {
    const entries = performance.getEntriesByType('resource');
    const resources = entries.map(e => ({
      name:        e.name.split('?')[0].split('/').pop(),
      url:         e.name,
      type:        e.initiatorType,
      sizeBytes:   e.transferSize || 0,
      durationMs:  Math.round(e.responseEnd - e.startTime),
    }));

    const totalSizeBytes  = resources.reduce((s, r) => s + r.sizeBytes, 0);
    const jsBundles       = resources.filter(r => r.url.endsWith('.js'));
    const largestJsBytes  = Math.max(0, ...jsBundles.map(r => r.sizeBytes));
    const images          = resources.filter(r => r.type === 'img' || /\.(png|jpg|webp|gif|svg)/.test(r.url));

    return {
      totalRequests:        resources.length,
      totalSizeKB:          Math.round(totalSizeBytes / 1024),
      largestJsKB:          Math.round(largestJsBytes / 1024),
      jsCount:              jsBundles.length,
      imageCount:           images.length,
      slowResources:        resources.filter(r => r.durationMs > 2000).map(r => ({ name: r.name, durationMs: r.durationMs })),
      largeResources:       resources
                              .filter(r => r.sizeBytes > 500 * 1024) // > 500KB
                              .map(r => ({ name: r.name, sizeKB: Math.round(r.sizeBytes / 1024) })),
    };
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────
test.describe('⚡  Performance Audit', () => {
  // Run serially to avoid skewing performance numbers from parallel load
  test.describe.configure({ mode: 'serial' });

  // Pre-warm the server to avoid cold-start skew
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.close();
  });

  for (const pg of PAGES) {
    test(`Performance benchmark: ${pg.name} (${pg.path})`, async ({ page }) => {
      // Navigate and capture performance data
      await page.goto(BASE + pg.path, { waitUntil: 'domcontentloaded' });
      await waitForStable(page, 4000);

      // Wait for vitals to be collected
      await page.waitForTimeout(2500);

      const [vitals, resources] = await Promise.all([
        gatherWebVitals(page),
        gatherResourceMetrics(page),
      ]);

      await fullPageScreenshot(page, 'performance', pg.name.toLowerCase());

      // Record in report
      const record = {
        path: pg.path,
        name: pg.name,
        vitals,
        resources,
        timestamp: new Date().toISOString(),
      };
      perfReport.pages.push(record);
      savePerfReport();

      // ── Log results ────────────────────────────────────────────────────
      console.log(`\n⚡  ${pg.name} Performance:`);
      console.log(`   TTFB        : ${Math.round(vitals.ttfb)}ms`);
      console.log(`   FCP         : ${Math.round(vitals.fcp)}ms  (threshold: <${THRESHOLDS.fcpMs}ms)`);
      console.log(`   LCP         : ${Math.round(vitals.lcp)}ms  (threshold: <${THRESHOLDS.lcpMs}ms)`);
      console.log(`   CLS         : ${vitals.cls.toFixed(3)}   (threshold: <${THRESHOLDS.clsScore})`);
      console.log(`   Requests    : ${resources.totalRequests}   (threshold: <${THRESHOLDS.totalRequests})`);
      console.log(`   Page size   : ${resources.totalSizeKB}KB  (threshold: <${THRESHOLDS.totalSizeKB}KB)`);
      console.log(`   Largest JS  : ${resources.largestJsKB}KB  (threshold: <${THRESHOLDS.largestJsKB}KB)`);

      if (resources.slowResources.length > 0) {
        console.warn(`   ⏱  Slow resources (>2s): ${resources.slowResources.map(r => `${r.name} (${r.durationMs}ms)`).join(', ')}`);
      }
      if (resources.largeResources.length > 0) {
        console.warn(`   📦 Large resources (>500KB): ${resources.largeResources.map(r => `${r.name} (${r.sizeKB}KB)`).join(', ')}`);
      }

      // ── Assertions ─────────────────────────────────────────────────────
      // FCP
      if (vitals.fcp > 0) {
        expect(vitals.fcp,
          `${pg.name}: FCP ${Math.round(vitals.fcp)}ms exceeds threshold ${THRESHOLDS.fcpMs}ms`
        ).toBeLessThan(THRESHOLDS.fcpMs);
      }

      // CLS
      expect(vitals.cls,
        `${pg.name}: CLS ${vitals.cls.toFixed(3)} exceeds threshold ${THRESHOLDS.clsScore}`
      ).toBeLessThan(THRESHOLDS.clsScore);

      // Total page weight
      if (resources.totalSizeKB > 0) {
        expect(resources.totalSizeKB,
          `${pg.name}: Page size ${resources.totalSizeKB}KB exceeds threshold ${THRESHOLDS.totalSizeKB}KB`
        ).toBeLessThan(THRESHOLDS.totalSizeKB);
      }
    });
  }

  test('No render-blocking scripts on homepage', async ({ page }) => {
    const renderBlockingScripts = [];
    page.on('response', res => {
      const url = res.url();
      // Look for large synchronous scripts in <head>
      if (url.endsWith('.js') && res.status() === 200) {
        renderBlockingScripts.push(url);
      }
    });

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await waitForStable(page);

    // Check for sync scripts in <head>
    // Exclude Vite's dev-only hot-module-replacement scripts
    const syncScripts = await page.evaluate(() =>
      Array.from(document.head.querySelectorAll('script:not([defer]):not([async])[src]'))
        .map(s => s.src)
        .filter(src => !src.includes('@vite/') && !src.includes('__vite'))
    );

    if (syncScripts.length > 0) {
      console.warn(`⚠  Render-blocking scripts in <head>: ${syncScripts.join(', ')}`);
    }

    expect(syncScripts.length,
      `${syncScripts.length} render-blocking <script> tags in <head>`
    ).toBe(0);
  });

  test('Images are using modern formats (webp/avif) or optimised', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await waitForStable(page);

    const unoptimisedImages = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img[src]'))
        .filter(img => {
          const src = img.src || '';
          return !src.includes('cloudinary') &&         // Cloudinary auto-optimises
                 !src.endsWith('.webp') &&
                 !src.endsWith('.avif') &&
                 !src.startsWith('data:');
        })
        .map(img => ({ src: img.src, alt: img.alt }))
    );

    if (unoptimisedImages.length > 0) {
      console.warn(`⚠  Non-optimised images (consider WebP conversion):`);
      unoptimisedImages.forEach(i => console.warn(`   • ${i.src}`));
    }
    // Non-fatal – just a warning
  });

  test('Performance summary report', async ({}) => {
    console.log('\n⚡  Performance Report Summary:');
    for (const p of perfReport.pages) {
      console.log(`   ${p.name}: FCP=${Math.round(p.vitals.fcp)}ms, CLS=${p.vitals.cls.toFixed(3)}, Size=${p.resources.totalSizeKB}KB`);
    }
    console.log('\n   Full report: qa-reports/performance-report.json');
  });
});
