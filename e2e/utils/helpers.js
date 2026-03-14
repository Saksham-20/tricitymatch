/**
 * Shared testing helpers for TricityMatch Playwright suite
 */
const path = require('path');
const fs   = require('fs');

// ── Screenshot helpers ──────────────────────────────────────────────────────

/**
 * Take a full-page screenshot and save to qa-reports/screenshots/<dir>/<name>.png
 */
async function fullPageScreenshot(page, dir, name) {
  const folder = path.join(process.cwd(), 'qa-reports', 'screenshots', dir);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, `${sanitize(name)}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

/**
 * Take a viewport screenshot (no scrolling)
 */
async function viewportScreenshot(page, dir, name) {
  const folder = path.join(process.cwd(), 'qa-reports', 'screenshots', dir);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, `${sanitize(name)}-viewport.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

// ── URL helpers ─────────────────────────────────────────────────────────────

/**
 * Check if a URL is internal (same origin as base)
 */
function isInternal(href, baseURL) {
  try {
    const url = new URL(href, baseURL);
    const base = new URL(baseURL);
    return url.hostname === base.hostname;
  } catch {
    return false;
  }
}

/**
 * Normalise a URL: strip hash, trailing slash, query params for dedup
 */
function normaliseURL(href) {
  try {
    const u = new URL(href);
    u.hash   = '';
    u.search = '';
    let p = u.pathname.replace(/\/$/, '') || '/';
    return u.origin + p;
  } catch {
    return href;
  }
}

// ── DOM audit helpers ────────────────────────────────────────────────────────

/**
 * Find overflow elements: elements that extend beyond the viewport width.
 * Excludes elements inside intentional horizontal-scroll or overflow:hidden containers
 * (e.g. profile card carousels, animated decorative rings).
 */
async function findOverflowElements(page) {
  return page.evaluate(() => {
    function isInsideClippingContainer(el) {
      let parent = el.parentElement;
      while (parent && parent !== document.documentElement) {
        const style  = window.getComputedStyle(parent);
        const ox     = style.overflowX;
        const ov     = style.overflow;
        if (ox === 'hidden' || ox === 'auto' || ox === 'scroll' ||
            ov === 'hidden' || ov === 'auto' || ov === 'scroll') return true;
        parent = parent.parentElement;
      }
      return false;
    }

    const issues = [];
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > window.innerWidth + 5) {
        if (!isInsideClippingContainer(el)) {
          issues.push({
            tag:      el.tagName.toLowerCase(),
            id:       el.id || null,
            class:    el.className || null,
            overflow: Math.round(rect.right - window.innerWidth),
          });
        }
      }
    });
    return issues.slice(0, 20); // cap to 20
  });
}

/**
 * Find images without alt text
 */
async function findImagesWithoutAlt(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('img'))
      .filter(img => !img.alt || img.alt.trim() === '')
      .map(img => ({ src: img.src, outerHTML: img.outerHTML.slice(0, 120) }))
  );
}

/**
 * Find broken images (naturalWidth === 0 after load)
 * Only flags images that have completely loaded but have naturalWidth=0 (truly broken).
 * Lazy-loaded images that haven't started downloading are NOT counted as broken.
 */
async function findBrokenImages(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('img'))
      .filter(img => img.complete && img.naturalWidth === 0)
      .map(img => ({ src: img.src || img.getAttribute('src'), outerHTML: img.outerHTML.slice(0, 120) }))
  );
}

/**
 * Collect all console errors captured during navigation
 */
function attachConsoleCapture(page) {
  const errors   = [];
  const warnings = [];
  page.on('console', msg => {
    if (msg.type() === 'error')   errors.push({ text: msg.text(), location: msg.location() });
    if (msg.type() === 'warning') warnings.push({ text: msg.text(), location: msg.location() });
  });
  page.on('pageerror', err => errors.push({ text: err.message, stack: err.stack }));
  return { errors, warnings };
}

/**
 * Collect network failures: 4xx/5xx responses
 */
function attachNetworkCapture(page) {
  const failures = [];
  page.on('response', res => {
    if (res.status() >= 400) {
      failures.push({ url: res.url(), status: res.status() });
    }
  });
  return failures;
}

// ── Utility ─────────────────────────────────────────────────────────────────

function sanitize(str) {
  return String(str).replace(/[^a-z0-9_\-]/gi, '_').slice(0, 80);
}

/**
 * Wait for the page to be visually stable (no pending network requests + animations settled)
 */
async function waitForStable(page, timeout = 5000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    // networkidle can time out on socket-heavy pages – that's fine
  }
}

/**
 * Try to dismiss any cookie banner / modal overlay before testing
 */
async function dismissOverlays(page) {
  const dismissSelectors = [
    'button:has-text("Accept")',
    'button:has-text("Got it")',
    'button:has-text("Close")',
    '[aria-label="Close"]',
    '[data-testid="modal-close"]',
  ];
  for (const sel of dismissSelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 })) {
        await btn.click();
        await page.waitForTimeout(300);
      }
    } catch { /* not present */ }
  }
}

module.exports = {
  fullPageScreenshot,
  viewportScreenshot,
  isInternal,
  normaliseURL,
  findOverflowElements,
  findImagesWithoutAlt,
  findBrokenImages,
  attachConsoleCapture,
  attachNetworkCapture,
  waitForStable,
  dismissOverlays,
  sanitize,
};
