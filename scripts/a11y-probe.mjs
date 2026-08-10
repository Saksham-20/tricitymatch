#!/usr/bin/env node
/**
 * Accessibility probe (P3') — axe-core over the ACQUISITION funnel.
 *
 * Scope is deliberate: the pages a stranger walks before they have an account.
 * A member who cannot use the app leaves; a stranger who cannot use the signup
 * funnel never becomes a member at all, and never tells us. The full-app audit
 * (VoiceOver, both themes, every route) is a separate, dated cycle.
 *
 * The gate is `critical` + `serious` only. `moderate`/`minor` are reported so
 * they are visible, but they do not fail the run — a gate that cries wolf gets
 * disabled, and then nothing is gated.
 *
 * Onboarding steps live behind client-side state, not URLs, so this walks into
 * them the way a person does (fill the identifier, press Continue) rather than
 * deep-linking a step that would render half-initialised.
 *
 * Usage
 *   node scripts/a11y-probe.mjs                    # default funnel
 *   node scripts/a11y-probe.mjs --base=https://tricitymatch.com
 *   node scripts/a11y-probe.mjs --json
 *
 * Exit code 1 if any critical/serious violation survives, so this can gate CI.
 */

import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/* ── config ───────────────────────────────────────────────────────────────── */
const GATE_IMPACTS = ['critical', 'serious'];
const REPORT_IMPACTS = ['critical', 'serious', 'moderate', 'minor'];

// WCAG 2.1 A + AA. `best-practice` is deliberately excluded from the gate: it
// carries opinions (e.g. heading-order) that are not conformance failures.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

const BASE = arg('base', process.env.PROBE_BASE || 'http://localhost:3000').replace(/\/$/, '');
const AS_JSON = flag('json');
const DEEP = flag('deep');
const BYPASS = arg('bypass', process.env.OTP_BYPASS_CODES || '');

/* ── funnel steps ─────────────────────────────────────────────────────────── */
/* Each step gets the page into a state, then names it for the report. Steps run
   in order against ONE page so the client-side onboarding state carries. */
const STEPS = [
  {
    name: 'landing (/)',
    enter: async (page) => {
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      // whileInView sections start at opacity 0; scroll so axe sees them rendered.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(600);
    },
  },
  {
    name: 'login (/login)',
    enter: async (page) => {
      await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(900);
    },
  },
  {
    name: 'login — password phase',
    enter: async (page) => {
      const id = page.locator('[name="identifier"]').first();
      await id.waitFor({ state: 'visible', timeout: 10000 });
      await id.fill('probe@example.com');
      await page.click('button[type="submit"]');
      await page.locator('input[type="password"]').first().waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(400);
    },
  },
  {
    name: 'signup step 1 (/signup)',
    enter: async (page) => {
      await page.goto(`${BASE}/signup`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
    },
  },
  {
    name: 'signup step 1 — OTP panel',
    enter: async (page) => {
      // Fill the identifier + password so the Send-OTP affordance renders. No
      // OTP is actually requested (that would text a real number); this only
      // needs the panel in the DOM for axe to see the segmented input.
      await page.locator('[name="identifier"]').first().fill('probe@example.com');
      await page.waitForTimeout(600);
    },
  },
];

/**
 * Deeper funnel steps — these CREATE AN ACCOUNT, so they only run with
 * `--deep`, and only against a dev server with `OTP_BYPASS_CODES` set. Without
 * the bypass, reaching step 2 means sending a real SMS or email to whatever
 * address the probe invented, which is not something a QA script gets to do.
 *
 * Run: OTP_BYPASS_CODES=000000 in .env.development (revert after), then
 *   node scripts/a11y-probe.mjs --deep --bypass=000000
 * Delete any created user afterwards.
 *
 * KNOWN LIMIT (measured 2026-08-10, not a product bug): this reaches the OTP
 * panel and scans the six segmented digit inputs, but does NOT get past it —
 * `OtpBoxes` completes on real key events, and Playwright's `fill` sets the
 * value without producing the sequence the component treats as a finished code.
 * So step 2 (name + the DOB selects) is still UNSCANNED by axe. Driving it
 * needs `pressSequentially` per box or a direct verify-then-navigate; worth
 * doing when someone next touches onboarding.
 */
const DEEP_STEPS = [
  {
    name: 'signup — OTP boxes (6 digits)',
    enter: async (page, { bypass }) => {
      const stamp = Date.now();
      const email = `a11y.probe.${stamp}@example.com`;
      // The earlier steps left an onboarding draft in localStorage; without
      // clearing it the reload RESUMES mid-flow and the OTP panel never
      // renders. (Cost me a 30s timeout to notice.)
      await page.goto(`${BASE}/signup`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      // `input:first` on this step is the PASSWORD box, not the identifier —
      // target the field by name so a layout change can't silently type the
      // email into the wrong control (which is exactly what happened first).
      await page.locator('[name="identifier"]').first().fill(email);
      await page.locator('input[type="password"]').first().fill('Probe@12345');
      // Terms checkbox
      const terms = page.locator('input[type="checkbox"]').first();
      if (await terms.count()) await terms.check({ force: true });

      await page.getByRole('button', { name: /send otp/i }).click({ timeout: 15000 });
      await page.waitForTimeout(1800);

      // OTP segmented input: type the bypass code digit by digit, which is
      // exactly what a person does — and proves focus advances on its own.
      const boxes = page.locator('input[aria-label^="Digit"], input[inputmode="numeric"], input[maxlength="1"]');
      const count = await boxes.count();
      if (count > 1) {
        // pressSequentially, not fill: OtpBoxes advances focus and fires
        // onComplete off real key events. `fill` sets the value without them,
        // so the code never registers as finished.
        await boxes.first().click();
        await page.keyboard.type(bypass, { delay: 90 });
      } else {
        await page.locator('input').nth(1).fill(bypass);
      }
      await page.waitForTimeout(3000);

      // Verification fires on the last digit and the step may advance on its
      // own, so the button can vanish mid-click. Either outcome is a real
      // funnel state worth scanning — don't fail the run over which one.
      try {
        await page.getByRole('button', { name: /next|create my profile|continue/i })
          .first()
          .click({ timeout: 8000 });
      } catch {
        // already advanced, or blocked by a validation message that is itself
        // part of the state being scanned
      }
      await page.waitForTimeout(2000);
    },
  },
];

/* ── keyboard traversal ───────────────────────────────────────────────────── */
/**
 * A page can pass axe and still be unusable by keyboard. This presses a REAL
 * Tab and reads the element that actually receives focus.
 *
 * Pressing Tab is not a stylistic choice — an earlier version called
 * `el.focus()` from inside the page and reported 7 elements with "no focus
 * ring" on the login form. All 7 were false: `.focus()` does not set
 * `:focus-visible`, which is what every ring in this codebase is keyed to. A
 * gate that invents findings gets ignored, so it presses the key.
 *
 * The ring itself may be an `outline` OR a Tailwind `ring-*` (a box-shadow), so
 * both count — but a box-shadow only counts if focusing CHANGED it, otherwise
 * every card with a resting shadow would look like it had a focus indicator.
 */
async function keyboardWalk(page, maxStops = 40) {
  const order = [];
  const noFocusRing = [];
  let last = null;
  let blanks = 0;

  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.activeElement?.blur?.();
  });

  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press('Tab');
    // Rings fade in via a CSS transition. Reading styles in the same tick
    // catches a box-shadow at ~0.2px and reports a false "no focus ring" —
    // verified by hand against the login password field, which does draw a
    // 2px outline. Let it settle first.
    await page.waitForTimeout(70);
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;

      const label =
        el.getAttribute('aria-label') ||
        (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 32) ||
        el.getAttribute('placeholder') ||
        el.getAttribute('name') ||
        '';
      const desc = `${el.tagName.toLowerCase()}${label ? ` "${label}"` : ''}`;

      const focused = getComputedStyle(el);
      const outlineVisible =
        focused.outlineStyle !== 'none' &&
        parseFloat(focused.outlineWidth) > 0 &&
        !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(focused.outlineColor);
      const focusedShadow = focused.boxShadow;

      // Baseline: what does this element look like when it is NOT focused?
      el.blur();
      const restingShadow = getComputedStyle(el).boxShadow;
      el.focus();

      const ringVisible = outlineVisible || focusedShadow !== restingShadow;
      return { desc, ringVisible, focusVisible: el.matches(':focus-visible') };
    });

    // Focus left the document (browser chrome). Keep tabbing — the next press
    // wraps back to the top of the page, which is the ONLY way to see the
    // elements ABOVE an autofocused field. Auth pages autofocus their first
    // input, so without this the walk silently skips the skip-link and nav.
    if (!stop) {
      if (++blanks >= 3) break;
      last = null;
      continue;
    }
    blanks = 0;
    if (order.includes(stop.desc) && stop.desc === order[0]) break; // full cycle
    if (stop.desc !== last) order.push(stop.desc);
    // Only a keyboard-focused element is expected to show a ring; a stop that
    // never reports :focus-visible is itself worth seeing, so it is reported.
    if (!stop.ringVisible) noFocusRing.push(stop.desc);
    last = stop.desc;
  }

  return { order, noFocusRing };
}

/* ── driver ───────────────────────────────────────────────────────────────── */
async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on('pageerror', () => {});

  const results = [];
  try {
    const steps = DEEP && BYPASS ? [...STEPS, ...DEEP_STEPS] : STEPS;
    if (DEEP && !BYPASS) {
      console.error('! --deep needs --bypass=<code> (and a dev server with OTP_BYPASS_CODES set) — skipping deep steps');
    }
    for (const step of steps) {
      try {
        await step.enter(page, { bypass: BYPASS });
        const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        const violations = axe.violations
          .filter((v) => REPORT_IMPACTS.includes(v.impact))
          .map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
            count: v.nodes.length,
          }));
        const keyboard = await keyboardWalk(page);
        results.push({ step: step.name, url: page.url(), violations, keyboard });
      } catch (err) {
        results.push({ step: step.name, error: err.message.split('\n')[0] });
      }
    }
  } finally {
    await browser.close();
  }

  if (AS_JSON) {
    console.log(JSON.stringify({ base: BASE, gate: GATE_IMPACTS, results }, null, 2));
  } else {
    report(results);
  }

  const gated = results.reduce(
    (n, r) => n + (r.violations?.filter((v) => GATE_IMPACTS.includes(v.impact)).length || 0),
    0
  );
  process.exit(gated > 0 ? 1 : 0);
}

function report(results) {
  console.log(`A11y probe · ${BASE} · 375x812 · gate: ${GATE_IMPACTS.join('+')} · ${TAGS.join(',')}\n`);
  let gated = 0;
  let advisory = 0;
  let noRing = 0;

  for (const r of results) {
    if (r.error) {
      console.log(`  ${r.step.padEnd(30)} ERROR  ${r.error}`);
      continue;
    }
    const hard = r.violations.filter((v) => GATE_IMPACTS.includes(v.impact));
    const soft = r.violations.filter((v) => !GATE_IMPACTS.includes(v.impact));
    console.log(
      `  ${r.step.padEnd(30)} ${(hard.length ? `FAIL ${hard.length}` : 'PASS').padEnd(8)}` +
        ` ${r.keyboard.order.length} tab stops` +
        (soft.length ? ` · ${soft.length} advisory` : '') +
        (r.keyboard.noFocusRing.length ? ` · ${r.keyboard.noFocusRing.length} no focus ring` : '')
    );
    for (const v of hard) console.log(`      ✗ [${v.impact}] ${v.id}: ${v.help} (${v.count}) — ${v.nodes[0]}`);
    for (const v of soft) console.log(`      ~ [${v.impact}] ${v.id}: ${v.help} (${v.count})`);
    for (const k of r.keyboard.noFocusRing.slice(0, 5)) console.log(`      ⌨ no focus ring: ${k}`);
    gated += hard.length;
    advisory += soft.length;
    noRing += r.keyboard.noFocusRing.length;
  }

  console.log(`\n  ${gated} gating · ${advisory} advisory · ${noRing} elements with no visible focus ring`);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
