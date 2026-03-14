/**
 * ========================================================================
 * ERROR DETECTION & CONSOLE MONITORING  –  TricityMatch QA Suite
 * ========================================================================
 * Monitors every public page for:
 *  • JavaScript runtime errors
 *  • Unhandled promise rejections
 *  • Console errors (non-noise)
 *  • Network 4xx / 5xx responses
 *  • Slow resources (> 3 s)
 *  • Missing/404 API calls
 *  • Uncaught React render errors
 * Saves a structured error-report.json to qa-reports/
 * ========================================================================
 */
const { test, expect } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');
const { waitForStable, fullPageScreenshot } = require('../utils/helpers');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

const PUBLIC_PAGES = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/terms',
  '/privacy',
];

// Noise patterns – skip these in the report (expected in dev)
const NOISE_PATTERNS = [
  /favicon/i,
  /net::ERR_/,
  /Failed to load resource/,
  /Download the React DevTools/i,
  /Warning: ReactDOM.render/i,
  /hot-update/i,
  /@vite\/client/i,
  // 401 on /api/auth/me is expected when unauthenticated (AuthContext polling)
  /auth\/me/,
  /401.*Unauthorized/i,
];

function isNoise(text) {
  return NOISE_PATTERNS.some(p => p.test(text));
}

// ── Error Report ──────────────────────────────────────────────────────────────
const errorReport = {
  generatedAt: new Date().toISOString(),
  pages: [],
  totalConsoleErrors: 0,
  totalNetworkErrors: 0,
  totalSlowResources: 0,
};

function saveErrorReport() {
  const dir = path.join(process.cwd(), 'qa-reports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'error-report.json'),
    JSON.stringify(errorReport, null, 2)
  );
}

// ── Per-page error audit ───────────────────────────────────────────────────
async function auditPageErrors(page, url) {
  const consoleErrors    = [];
  const consoleWarnings  = [];
  const networkErrors    = [];
  const slowResources    = [];
  const pageErrors       = [];

  // Console listener
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (isNoise(text)) return;
    if (type === 'error')   consoleErrors.push({ text, location: msg.location() });
    if (type === 'warning') consoleWarnings.push({ text });
  });

  // Unhandled page errors (JS exceptions)
  page.on('pageerror', err => {
    if (!isNoise(err.message)) {
      pageErrors.push({ message: err.message, stack: err.stack?.slice(0, 400) });
    }
  });

  // Network responses
  const resourceTimings = [];
  page.on('response', async res => {
    const status = res.status();
    const resUrl = res.url();
    if (status >= 400) {
      networkErrors.push({ url: resUrl, status, method: res.request().method() });
    }
  });

  // Request timing
  page.on('requestfinished', async req => {
    try {
      const timing = await req.timing();
      const duration = timing.responseEnd - timing.requestStart;
      if (duration > 3000) {
        slowResources.push({ url: req.url(), durationMs: Math.round(duration) });
      }
    } catch { /* timing not always available */ }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await waitForStable(page, 6000);

  const urlKey = url.replace(BASE, '').replace(/[^a-z0-9]/gi, '_') || 'home';
  await fullPageScreenshot(page, 'errors', urlKey).catch(() => null);

  // Record
  const pageRecord = {
    url,
    consoleErrors,
    pageErrors,
    networkErrors,
    consoleWarnings: consoleWarnings.slice(0, 5),
    slowResources,
  };

  errorReport.pages.push(pageRecord);
  errorReport.totalConsoleErrors  += consoleErrors.length + pageErrors.length;
  errorReport.totalNetworkErrors  += networkErrors.length;
  errorReport.totalSlowResources  += slowResources.length;
  saveErrorReport();

  return pageRecord;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
test.describe('🚨 Error Detection & Console Monitoring', () => {
  test.describe.configure({ mode: 'serial' });

  for (const route of PUBLIC_PAGES) {
    test(`No critical errors on: ${route || '/'}`, async ({ page }) => {
      const result = await auditPageErrors(page, BASE + route);

      // Log findings
      if (result.consoleErrors.length > 0) {
        console.warn(`\n⚠  Console errors on ${route}:`);
        result.consoleErrors.forEach(e => console.warn(`   • ${e.text}`));
      }
      if (result.pageErrors.length > 0) {
        console.warn(`\n💥 Uncaught JS errors on ${route}:`);
        result.pageErrors.forEach(e => console.warn(`   • ${e.message}`));
      }
      if (result.networkErrors.length > 0) {
        console.warn(`\n🔴 Network errors on ${route}:`);
        result.networkErrors.forEach(e => console.warn(`   • ${e.status} ${e.url}`));
      }
      if (result.slowResources.length > 0) {
        console.warn(`\n🐢 Slow resources on ${route}:`);
        result.slowResources.forEach(r => console.warn(`   • ${r.durationMs}ms – ${r.url}`));
      }

      // Hard failures: zero uncaught JS errors
      expect(result.pageErrors.length,
        `Uncaught JS errors on ${route}: ${result.pageErrors.map(e => e.message).join('; ')}`
      ).toBe(0);

      // No 5xx server errors
      const serverErrors = result.networkErrors.filter(e => e.status >= 500);
      expect(serverErrors.length,
        `Server errors (5xx) on ${route}: ${serverErrors.map(e => `${e.status} ${e.url}`).join(', ')}`
      ).toBe(0);
    });
  }

  test('No 404 responses for critical static assets', async ({ page }) => {
    const missingAssets = [];
    page.on('response', res => {
      if (res.status() === 404) {
        const url = res.url();
        // Only flag assets (not API calls which are expected to 404 in dev)
        if (!url.includes('/api/')) {
          missingAssets.push(url);
        }
      }
    });

    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await waitForStable(page);

    if (missingAssets.length > 0) {
      console.warn('⚠  Missing static assets (404):');
      missingAssets.forEach(a => console.warn(`   • ${a}`));
    }

    // CSS and JS bundles must not 404
    const criticalMissing = missingAssets.filter(u =>
      u.endsWith('.css') || u.endsWith('.js') || u.includes('/assets/')
    );
    expect(criticalMissing.length,
      `Critical assets missing (404): ${criticalMissing.join(', ')}`
    ).toBe(0);
  });

  test('Final error report summary', async ({}) => {
    // This runs last to print the summary
    console.log('\n📋 Error Report Summary:');
    console.log(`   Total pages audited  : ${errorReport.pages.length}`);
    console.log(`   Console errors total : ${errorReport.totalConsoleErrors}`);
    console.log(`   Network errors total : ${errorReport.totalNetworkErrors}`);
    console.log(`   Slow resources total : ${errorReport.totalSlowResources}`);
    console.log('\n   Full report: qa-reports/error-report.json');
  });
});
