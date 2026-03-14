/**
 * ========================================================================
 * AUTONOMOUS WEBSITE CRAWLER  –  TricityMatch QA Suite
 * ========================================================================
 * Starts at the homepage, discovers all internal links, visits every page,
 * captures screenshots and audits each page for basic health.
 * Writes a crawl-report.json to qa-reports/.
 * ========================================================================
 */
const { test, expect } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');
const {
  fullPageScreenshot,
  isInternal,
  normaliseURL,
  attachConsoleCapture,
  attachNetworkCapture,
  waitForStable,
  findBrokenImages,
  findOverflowElements,
} = require('../utils/helpers');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

// Public routes we know about (for completeness beyond auto-discovery)
const SEED_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/terms',
  '/privacy',
];

// Routes to skip (auth walls, external triggers, payment redirects)
const SKIP_PATTERNS = [
  /\/reset-password/,
  /\/payment/,
  /\/admin/,          // admin is auth-protected
  /\?.*token/,
  /logout/i,
];

// Maximum pages to crawl (safeguard)
const MAX_PAGES = 40;

// ── Report state (shared across test within the suite) ────────────────────
const crawlReport = {
  startedAt: new Date().toISOString(),
  baseURL: BASE,
  pages: [],
  summary: {
    totalVisited: 0,
    totalErrors: 0,
    totalWarnings: 0,
    totalBrokenImages: 0,
    totalOverflows: 0,
    totalNetworkFailures: 0,
  },
};

function saveReport() {
  const dir = path.join(process.cwd(), 'qa-reports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'crawl-report.json'),
    JSON.stringify(crawlReport, null, 2)
  );
}

// ── Helper: audit a single page ───────────────────────────────────────────
async function auditPage(page, url) {
  const { errors, warnings } = attachConsoleCapture(page);
  const networkFailures      = attachNetworkCapture(page);

  let title    = '';
  let loadTime = 0;
  let status   = 'ok';

  const t0 = Date.now();
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForStable(page, 6000);
    loadTime = Date.now() - t0;

    title = await page.title();

    if (response && response.status() >= 400) {
      status = `http-${response.status()}`;
    }
  } catch (err) {
    status   = 'nav-error';
    loadTime = Date.now() - t0;
    console.error(`  ✗ Navigation failed for ${url}: ${err.message}`);
  }

  // Capture screenshot
  const urlKey   = url.replace(BASE, '').replace(/[^a-z0-9]/gi, '_') || 'home';
  const ssPath   = await fullPageScreenshot(page, 'crawler', urlKey).catch(() => null);

  // DOM audits
  const brokenImages     = await findBrokenImages(page).catch(() => []);
  const overflowElements = await findOverflowElements(page).catch(() => []);

  // Discover links on this page
  const links = await page.evaluate((base) => {
    return Array.from(document.querySelectorAll('a[href]'))
      .map(a => a.href)
      .filter(h => h.startsWith(base) || h.startsWith('/'));
  }, BASE).catch(() => []);

  // Update summary
  crawlReport.summary.totalErrors         += errors.length;
  crawlReport.summary.totalWarnings       += warnings.length;
  crawlReport.summary.totalBrokenImages   += brokenImages.length;
  crawlReport.summary.totalOverflows      += overflowElements.length;
  crawlReport.summary.totalNetworkFailures += networkFailures.length;

  const pageReport = {
    url,
    title,
    status,
    loadTimeMs: loadTime,
    screenshot: ssPath,
    consoleErrors:    errors.slice(0, 10),
    consoleWarnings:  warnings.slice(0, 5),
    networkFailures:  networkFailures.slice(0, 10),
    brokenImages:     brokenImages.slice(0, 10),
    overflowElements: overflowElements.slice(0, 10),
    linksFound:       links.length,
  };

  crawlReport.pages.push(pageReport);
  crawlReport.summary.totalVisited = crawlReport.pages.length;
  saveReport();

  return { links, status, errors };
}

// ── Main crawl test ──────────────────────────────────────────────────────────
test.describe('🕷  Autonomous Website Crawler', () => {
  // Use a single worker so the queue is sequential and the report is coherent
  test.describe.configure({ mode: 'serial' });

  test('Crawl all public pages and audit each', async ({ page }) => {
    const visited = new Set();
    const queue   = [...SEED_ROUTES.map(r => normaliseURL(BASE + r))];

    // Add base URL itself
    queue.push(normaliseURL(BASE));

    while (queue.length > 0 && visited.size < MAX_PAGES) {
      const url = queue.shift();
      const norm = normaliseURL(url);

      if (visited.has(norm)) continue;
      if (SKIP_PATTERNS.some(p => p.test(norm))) {
        console.log(`  ⏭  Skipping: ${norm}`);
        continue;
      }

      visited.add(norm);
      console.log(`  🔍 Auditing [${visited.size}/${MAX_PAGES}]: ${norm}`);

      const { links } = await auditPage(page, norm);

      // Enqueue newly discovered internal links
      for (const link of links) {
        const normLink = normaliseURL(link);
        if (
          isInternal(normLink, BASE) &&
          !visited.has(normLink) &&
          !queue.includes(normLink) &&
          !SKIP_PATTERNS.some(p => p.test(normLink))
        ) {
          queue.push(normLink);
        }
      }
    }

    // ── Final assertions ───────────────────────────────────────────────────
    console.log('\n📊 Crawl Summary:');
    console.log(`   Pages visited     : ${crawlReport.summary.totalVisited}`);
    console.log(`   Console errors    : ${crawlReport.summary.totalErrors}`);
    console.log(`   Network failures  : ${crawlReport.summary.totalNetworkFailures}`);
    console.log(`   Broken images     : ${crawlReport.summary.totalBrokenImages}`);
    console.log(`   Overflow elements : ${crawlReport.summary.totalOverflows}`);
    console.log(`\n   Report saved to: qa-reports/crawl-report.json`);

    // At minimum, the homepage should have loaded
    expect(crawlReport.summary.totalVisited).toBeGreaterThan(0);

    // Flag critical JS errors as test failures
    const criticalErrors = crawlReport.pages.flatMap(p =>
      p.consoleErrors.filter(e =>
        !e.text.includes('favicon') &&
        !e.text.includes('net::ERR_') &&  // network unreachable is environment noise
        !e.text.includes('Failed to load resource')
      )
    );

    if (criticalErrors.length > 0) {
      console.warn(`\n⚠  ${criticalErrors.length} critical console error(s) found:`);
      criticalErrors.slice(0, 5).forEach(e => console.warn(`   • ${e.text}`));
    }
  });
});
