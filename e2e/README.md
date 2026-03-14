# TricityMatch – QA Automation Suite

Automated QA system built on **Playwright** + **axe-core** that acts as a fully autonomous QA engineer.

---

## What It Does

| Module | File | What it checks |
|---|---|---|
| **Auth Flow** | `01-auth-flow.spec.js` | Login, Signup, Forgot Password, Protected Route Guards, Form Validation |
| **Crawler** | `02-crawler.spec.js` | Auto-discovers all pages, visits each one, reports errors, images, overflows |
| **Visual UI** | `03-visual-ui.spec.js` | Full-page screenshots at desktop/tablet/mobile, overflow detection, font checks |
| **UX Interactions** | `04-ux-interactions.spec.js` | Nav links, forms, keyboard navigation, modals, mobile menu, CTAs |
| **Error Detection** | `05-error-detection.spec.js` | JS console errors, uncaught exceptions, 4xx/5xx network failures, slow resources |
| **Accessibility** | `06-accessibility.spec.js` | axe-core WCAG 2.1 AA, alt text, heading hierarchy, focus rings, form labels |
| **Performance** | `07-performance.spec.js` | FCP, LCP, CLS, page size, JS bundle sizes, render-blocking scripts |
| **Broken Assets** | `08-broken-assets.spec.js` | 404 images, fonts, CSS, favicon, Web App Manifest, empty src attributes |

---

## Quick Start

### Prerequisites
- Node.js ≥ 18
- Frontend dev server running at `http://localhost:3000`

### Run all tests
```bash
# Start the frontend first (if not running)
npm run dev:frontend

# Run the full QA suite (all 8 modules, 3 browsers)
npm run qa

# Then generate the HTML report
npm run qa:report
```

The HTML report opens at: `qa-reports/QA-REPORT.html`

---

## Individual Test Suites

```bash
npm run qa:auth       # Auth flow tests only
npm run qa:crawl      # Autonomous crawler only
npm run qa:visual     # Visual UI screenshots only
npm run qa:ux         # UX interaction tests only
npm run qa:errors     # Console & network error detection
npm run qa:a11y       # Accessibility audit (axe-core)
npm run qa:perf       # Performance metrics only
npm run qa:assets     # Broken asset detection only
```

## Run by Browser / Device

```bash
npm run qa:desktop    # Desktop Chrome 1280×800
npm run qa:mobile     # Mobile Chrome (Galaxy S9+)
npx playwright test --project=tablet   # iPad viewport
```

## Debugging

```bash
npm run qa:headed     # Run in visible browser window
npm run qa:debug      # Step-through with Playwright Inspector
npm run qa:ui         # Open the Playwright HTML report
```

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `BASE_URL` | `http://localhost:3000` | Target URL for all tests |
| `TEST_USER_EMAIL` | _(unset)_ | Email for live login test |
| `TEST_USER_PASSWORD` | _(unset)_ | Password for live login test |

Example `.env` for CI:
```env
BASE_URL=https://staging.tricitymatch.com
TEST_USER_EMAIL=qa@tricitymatch.com
TEST_USER_PASSWORD=StagingQA@2025
```

---

## Output Files

After running, the following artifacts are created in `qa-reports/`:

```
qa-reports/
  QA-REPORT.html              ← Self-contained HTML report (the main output)
  crawl-report.json           ← Crawler findings
  error-report.json           ← Console & network errors
  accessibility-report.json   ← axe-core violations
  performance-report.json     ← Core Web Vitals & sizes
  broken-assets-report.json   ← 404 assets, broken images
  results.json                ← Playwright raw results
  playwright-html/            ← Playwright's built-in HTML reporter
  screenshots/                ← Full-page screenshots per page/viewport
    crawler/
    visual/
    a11y/
    performance/
    assets/
    auth/
    ux/
    errors/
  test-results/               ← Videos & traces on failure
```

---

## Test Architecture

```
e2e/
  fixtures/
    auth.fixture.js         ← Authenticated page fixture (reusable)
  tests/
    01-auth-flow.spec.js
    02-crawler.spec.js
    03-visual-ui.spec.js
    04-ux-interactions.spec.js
    05-error-detection.spec.js
    06-accessibility.spec.js
    07-performance.spec.js
    08-broken-assets.spec.js
  utils/
    helpers.js              ← Shared utilities (screenshots, DOM checks, etc.)
    generate-report.js      ← HTML report generator
playwright.config.js        ← Root Playwright configuration
```

---

## Browser Matrix

| Project | Viewport | Device |
|---|---|---|
| `desktop-chrome` | 1280 × 800 | Desktop |
| `mobile-chrome` | 360 × 800 | Samsung Galaxy S9+ |
| `tablet` | 810 × 1080 | iPad Gen 7 |

To add Firefox or Safari:
```js
// playwright.config.js → projects array
{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
{ name: 'safari',  use: { ...devices['Desktop Safari']  } },
```

---

## CI Integration (GitHub Actions)

```yaml
# .github/workflows/qa.yml
name: QA Audit
on: [push, pull_request]
jobs:
  qa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx playwright install chromium
      - run: npm run dev:frontend &
      - run: sleep 10  # wait for server
      - run: npm run qa
      - run: npm run qa:report
      - uses: actions/upload-artifact@v4
        with:
          name: qa-reports
          path: qa-reports/
```

---

## Severity Guide

| Level | Meaning |
|---|---|
| 🔴 **Critical** | App unusable, data loss risk – fix immediately |
| 🟠 **Serious** | Major UX/accessibility issue – fix before release |
| 🟡 **Moderate** | Noticeable UX degradation – fix in next sprint |
| 🟢 **Minor** | Polish / improvement – backlog |
| ℹ **Info** | Best-practice suggestion |

---

## Adding New Tests

1. Create a new file in `e2e/tests/` following the naming pattern `NN-name.spec.js`
2. Import helpers from `../utils/helpers`
3. Use `test.describe()` with descriptive names
4. Capture screenshots with `fullPageScreenshot(page, 'category', 'name')`
5. Add a corresponding `npm run qa:newtest` script in `package.json`
