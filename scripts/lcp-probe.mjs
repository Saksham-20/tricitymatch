#!/usr/bin/env node
/**
 * LCP probe (P4') — Largest Contentful Paint on the acquisition page.
 *
 * Budget: 2.5s at 375px on throttled 4G. That is Google's "good" threshold and
 * the plan's stated target; the landing page gets a number, not a vibes check.
 *
 * Throttling is applied through CDP (Network.emulateNetworkConditions +
 * Emulation.setCPUThrottlingRate) rather than trusting a fast dev machine on
 * fibre — the person this page has to load for is on a phone on mobile data.
 *
 * Measure PRODUCTION, not the dev server: Vite serves unminified modules over
 * hundreds of separate requests in dev, so a dev number is fiction in both
 * directions. Default base is the live site for that reason.
 *
 * Usage
 *   node scripts/lcp-probe.mjs                       # https://tricitymatch.com
 *   node scripts/lcp-probe.mjs --base=http://localhost:4173   # vite preview
 *   node scripts/lcp-probe.mjs --routes=/,/about --runs=5
 *   node scripts/lcp-probe.mjs --json
 *
 * Exit code 1 when the median LCP of any route exceeds the budget.
 */

import { chromium } from '@playwright/test';

/* ── config ───────────────────────────────────────────────────────────────── */
const BUDGET_MS = 2500;

// "Slow 4G"-ish: the profile Lighthouse uses for mobile.
const NETWORK = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8, // 1.6 Mbps
  uploadThroughput: (750 * 1024) / 8, // 750 Kbps
  latency: 150, // ms RTT
};
const CPU_THROTTLE = 4; // 4x slowdown — a mid-range Android

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

const BASE = arg('base', process.env.PROBE_BASE || 'https://tricitymatch.com').replace(/\/$/, '');
const RUNS = Number(arg('runs', '3'));
const AS_JSON = flag('json');
const ROUTES = arg('routes', '/').split(',').filter(Boolean);

/* ── measurement ──────────────────────────────────────────────────────────── */
async function measureOnce(browser, route) {
  // A fresh context per run: a warm HTTP cache measures the second visit, and
  // the number that matters is the first one.
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', NETWORK);
  await client.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });

  // Register the observer before navigation so no entry is missed.
  await page.addInitScript(() => {
    window.__lcp = 0;
    window.__lcpEl = '';
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__lcp = entry.renderTime || entry.loadTime || entry.startTime;
        const el = entry.element;
        window.__lcpEl = el
          ? `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(/\s+/)[0]}` : ''}` +
            ` "${(el.textContent || '').trim().slice(0, 40)}"`
          : '(image)';
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });

  const t0 = Date.now();
  await page.goto(`${BASE}${route}`, { waitUntil: 'load', timeout: 90000 });
  // LCP can still move after load; give late candidates (fonts swapping in,
  // hero images decoding) a chance before reading the final value.
  await page.waitForTimeout(3000);

  const result = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    return {
      lcp: Math.round(window.__lcp),
      lcpEl: window.__lcpEl,
      fcp: fcp ? Math.round(fcp.startTime) : null,
      ttfb: nav.responseStart ? Math.round(nav.responseStart) : null,
      domContentLoaded: nav.domContentLoadedEventEnd ? Math.round(nav.domContentLoadedEventEnd) : null,
      // Anything fetched from a third-party host delays the render it blocks.
      thirdParty: performance
        .getEntriesByType('resource')
        .filter((r) => !r.name.startsWith(location.origin))
        .map((r) => ({ url: r.name.replace(/^https?:\/\//, '').slice(0, 60), start: Math.round(r.startTime), dur: Math.round(r.duration) }))
        .sort((a, b) => b.dur - a.dur)
        .slice(0, 6),
    };
  });

  result.wall = Date.now() - t0;
  await context.close();
  return result;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

async function main() {
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const route of ROUTES) {
      const runs = [];
      for (let i = 0; i < RUNS; i++) runs.push(await measureOnce(browser, route));
      results.push({
        route,
        median: median(runs.map((r) => r.lcp)),
        runs: runs.map((r) => r.lcp),
        lcpEl: runs[runs.length - 1].lcpEl,
        fcp: median(runs.map((r) => r.fcp ?? 0)),
        ttfb: median(runs.map((r) => r.ttfb ?? 0)),
        thirdParty: runs[runs.length - 1].thirdParty,
      });
    }
  } finally {
    await browser.close();
  }

  if (AS_JSON) {
    console.log(JSON.stringify({ base: BASE, budgetMs: BUDGET_MS, network: NETWORK, cpu: CPU_THROTTLE, results }, null, 2));
  } else {
    console.log(
      `LCP probe · ${BASE} · 375x812 · ${(NETWORK.downloadThroughput * 8) / 1024 / 1024}Mbps/${NETWORK.latency}ms RTT · ${CPU_THROTTLE}x CPU · budget ${BUDGET_MS}ms\n`
    );
    for (const r of results) {
      const ok = r.median <= BUDGET_MS;
      console.log(
        `  ${r.route.padEnd(12)} ${(ok ? 'PASS' : 'FAIL').padEnd(6)} LCP ${String(r.median).padStart(5)}ms` +
          `  (runs ${r.runs.join('/')})  FCP ${r.fcp}ms  TTFB ${r.ttfb}ms`
      );
      console.log(`      element: ${r.lcpEl}`);
      for (const t of r.thirdParty) console.log(`      3rd-party ${String(t.dur).padStart(5)}ms @${t.start}ms  ${t.url}`);
    }
    const worst = Math.max(...results.map((r) => r.median));
    console.log(`\n  worst median ${worst}ms vs ${BUDGET_MS}ms budget`);
  }

  process.exit(results.some((r) => r.median > BUDGET_MS) ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
