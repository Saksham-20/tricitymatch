#!/usr/bin/env node
/**
 * Tap-target probe (P1.2) — repeatable replacement for the ad-hoc Playwright
 * measurement the 2026-08-09 audit ran and lost.
 *
 * Loads each route at 375x667 (iPhone SE, the narrowest supported viewport),
 * measures every interactive element, and reports:
 *
 *   FAIL  — any visible interactive element under 24px on either axis.
 *           24px is the WCAG 2.5.8 (AA) floor; this is the gate.
 *   WARN  — primary actions (submit buttons, standalone CTAs) under 44px tall.
 *           44px is the WCAG 2.5.5 (AAA) / Apple HIG target.
 *
 * Elements are measured by their *hit box*, not their text box: an <a> padded
 * with `px-2 py-2 -mx-2 -my-2` reports the padded rect, which is exactly the
 * zero-layout-shift fix pattern this repo uses. Inline links inside running
 * prose are exempt (WCAG 2.5.8 "inline" exception) — they are detected by
 * looking for sibling text in the parent block.
 *
 * Usage
 *   node scripts/tap-target-probe.mjs                      # public routes
 *   node scripts/tap-target-probe.mjs --all                # + member routes (needs login)
 *   node scripts/tap-target-probe.mjs --routes=/,/about
 *   node scripts/tap-target-probe.mjs --base=http://localhost:3000
 *   node scripts/tap-target-probe.mjs --json               # machine-readable
 *
 * Auth for member routes:
 *   PROBE_EMAIL / PROBE_PASSWORD  (default: seeded dev member)
 *
 * Exit code 1 when any route has a FAIL, so this can gate CI.
 */

import { chromium } from '@playwright/test';

/* ── config ───────────────────────────────────────────────────────────────── */
const MIN_HIT = 24; // WCAG 2.5.8 AA floor — hard gate
const PRIMARY_MIN = 44; // WCAG 2.5.5 AAA / HIG — reported as WARN

const PUBLIC_ROUTES = [
  '/', '/about', '/contact', '/safety', '/success-stories', '/login', '/terms', '/privacy',
  // City landing pages (Phase S). One template, so probing one instance would
  // cover the layout — all three are listed because they are indexed URLs and a
  // regression on any of them is a regression on a page Google sends people to.
  '/matrimony/chandigarh', '/matrimony/mohali', '/matrimony/panchkula',
];
const MEMBER_ROUTES = ['/dashboard', '/settings', '/search', '/matches', '/profile', '/notifications', '/subscription'];

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

const BASE = arg('base', process.env.PROBE_BASE || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.PROBE_EMAIL || 'rahul.sharma1@example.com';
const PASSWORD = process.env.PROBE_PASSWORD || 'Pass@1234';
const AS_JSON = flag('json');

const routes = arg('routes', null)
  ? arg('routes', '').split(',').filter(Boolean)
  : flag('all')
    ? [...PUBLIC_ROUTES, ...MEMBER_ROUTES]
    : PUBLIC_ROUTES;

const needsAuth = routes.some((r) => MEMBER_ROUTES.includes(r));

/* ── in-page measurement ──────────────────────────────────────────────────── */
/* Runs in the browser. Kept as one self-contained function so it can be pasted
   into devtools when debugging a single element. */
function measure({ MIN_HIT, PRIMARY_MIN }) {
  const SELECTOR = 'a[href], button, [role="button"], [role="tab"], [role="menuitem"], [role="switch"], input, select, textarea, label[for], summary';

  const describe = (el) => {
    const label =
      el.getAttribute('aria-label') ||
      (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48) ||
      el.getAttribute('title') ||
      el.getAttribute('placeholder') ||
      el.getAttribute('name') ||
      '';
    const cls = (el.getAttribute('class') || '').split(/\s+/).slice(0, 4).join(' ');
    const type = el.getAttribute('type');
    return `${el.tagName.toLowerCase()}${type ? `[${type}]` : ''} "${label}"${cls ? ` .${cls}` : ''}`;
  };

  /* WCAG 2.5.8 exempts targets that sit inline in a sentence. Heuristic: the
     element's parent block holds text that is not just this element. */
  const isInlineInProse = (el) => {
    if (el.tagName !== 'A') return false;
    const p = el.parentElement;
    if (!p) return false;
    const own = (el.textContent || '').trim();
    const all = (p.textContent || '').trim();
    return all.length > own.length + 12 && getComputedStyle(el).display === 'inline';
  };

  /* Visually-hidden (sr-only / skip links). Collapsed to 1px with overflow
     hidden or clipped away — they only exist for AT and become full size on
     focus, so their collapsed rect is not a tap target. */
  const isVisuallyHidden = (el, rect, style) => {
    if (rect.width > 2 || rect.height > 2) return false;
    return style.overflow === 'hidden' || /inset\(50%|rect\(/.test(style.clipPath || style.clip || '');
  };

  /* A "primary action" is a form submit or a button/link styled as a full CTA.
     NOTE: read the type ATTRIBUTE, not el.type — a React <button> with no type
     reports el.type === 'submit', which would flag every icon button. */
  const isPrimaryAction = (el, rect) => {
    const type = el.getAttribute('type');
    if (el.tagName === 'BUTTON' && type === 'submit') return true;
    if (el.tagName === 'INPUT' && (type === 'submit' || type === 'button')) return true;
    const cls = el.getAttribute('class') || '';
    if (/\bbtn-(primary|gold)\b/.test(cls)) return true;
    // Wide, standalone controls read as primary on a 375px screen.
    return rect.width >= 200 && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button');
  };

  const seen = new Set();
  const fails = [];
  const warns = [];
  let counted = 0;

  for (const el of document.querySelectorAll(SELECTOR)) {
    if (el.type === 'hidden' || el.disabled) continue;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
    if (el.closest('[aria-hidden="true"], [inert]')) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (isVisuallyHidden(el, rect, style)) continue;

    /* WCAG 2.5.8 "Equivalent" exception: a caption <label> that points at a
       control which is itself big enough is not a separate failure — clicking
       either does the same thing. */
    if (el.tagName === 'LABEL') {
      const target = document.getElementById(el.getAttribute('for'));
      if (target) {
        const tr = target.getBoundingClientRect();
        if (tr.width >= MIN_HIT && tr.height >= MIN_HIT) continue;
      }
    }
    seen.add(el);
    counted++;

    const w = Math.round(rect.width * 10) / 10;
    const h = Math.round(rect.height * 10) / 10;
    const entry = { el: describe(el), w, h };

    if ((w < MIN_HIT || h < MIN_HIT) && !isInlineInProse(el)) {
      fails.push(entry);
    } else if (isPrimaryAction(el, rect) && h < PRIMARY_MIN) {
      warns.push(entry);
    }
  }

  return { counted, fails, warns };
}

/* ── driver ───────────────────────────────────────────────────────────────── */
async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  const id = page.locator('[name="identifier"]').first();
  await id.waitFor({ state: 'visible', timeout: 15000 });
  await id.fill(EMAIL);
  await page.click('button[type="submit"]');
  const pw = page.locator('input[type="password"]').first();
  await pw.waitFor({ state: 'visible', timeout: 15000 });
  await pw.fill(PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
}

async function probeRoute(page, route) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
  // Let lazy chunks + first data fetch settle; networkidle is flaky with sockets.
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollTo(0, 0));
  const landed = new URL(page.url()).pathname;
  const result = await page.evaluate(measure, { MIN_HIT, PRIMARY_MIN });
  return { route, landed, ...result };
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on('pageerror', () => {});

  const results = [];
  try {
    if (needsAuth) {
      try {
        await login(page);
      } catch (err) {
        console.error(`! login failed (${err.message.split('\n')[0]}) — member routes will report their redirect target`);
      }
    }
    for (const route of routes) {
      try {
        results.push(await probeRoute(page, route));
      } catch (err) {
        results.push({ route, error: err.message.split('\n')[0] });
      }
    }
  } finally {
    await browser.close();
  }

  if (AS_JSON) {
    console.log(JSON.stringify({ base: BASE, minHit: MIN_HIT, primaryMin: PRIMARY_MIN, results }, null, 2));
  } else {
    report(results);
  }

  const failed = results.reduce((n, r) => n + (r.fails?.length || 0), 0);
  process.exit(failed > 0 ? 1 : 0);
}

function report(results) {
  console.log(`Tap-target probe · ${BASE} · 375x667 · floor ${MIN_HIT}px, primary ${PRIMARY_MIN}px\n`);
  let totalFail = 0;
  let totalWarn = 0;

  for (const r of results) {
    if (r.error) {
      console.log(`  ${r.route.padEnd(18)} ERROR  ${r.error}`);
      continue;
    }
    const redirect = r.landed !== r.route ? ` → ${r.landed}` : '';
    const status = r.fails.length ? `FAIL ${r.fails.length}` : 'PASS';
    console.log(
      `  ${r.route.padEnd(18)} ${status.padEnd(8)} ${String(r.counted).padStart(3)} interactive` +
        (r.warns.length ? ` · ${r.warns.length} primary <${PRIMARY_MIN}px` : '') +
        redirect
    );
    for (const f of r.fails) console.log(`      ✗ ${f.w}x${f.h}  ${f.el}`);
    for (const w of r.warns) console.log(`      ~ ${w.w}x${w.h}  ${w.el}`);
    totalFail += r.fails.length;
    totalWarn += r.warns.length;
  }

  console.log(`\n  ${totalFail} under ${MIN_HIT}px · ${totalWarn} primary actions under ${PRIMARY_MIN}px`);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
