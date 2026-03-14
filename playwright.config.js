// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * TricityMatch – Playwright Master Configuration
 * Covers: Desktop Chrome, Mobile Chrome, Tablet viewport
 * Features: Screenshots, Video recording, Trace viewer, Parallel execution
 */
module.exports = defineConfig({
  // ── Test directory ─────────────────────────────────────────────────────────
  testDir: './e2e/tests',
  testMatch: '**/*.spec.js',

  // ── Parallel execution ──────────────────────────────────────────────────────
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,

  // ── Retries on failure ──────────────────────────────────────────────────────
  retries: process.env.CI ? 2 : 1,

  // ── Reporters ──────────────────────────────────────────────────────────────
  reporter: [
    ['list'],
    ['html', { outputFolder: 'qa-reports/playwright-html', open: 'never' }],
    ['json', { outputFile: 'qa-reports/results.json' }],
    ['junit', { outputFile: 'qa-reports/results.xml' }],
  ],

  // ── Global test settings ───────────────────────────────────────────────────
  use: {
    // Base URL of the running frontend
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording: retain only on failure
    video: 'retain-on-failure',

    // Trace: capture on first retry
    trace: 'on-first-retry',

    // Timeouts
    actionTimeout: 15_000,
    navigationTimeout: 30_000,

    // Viewport
    viewport: { width: 1280, height: 800 },

    // Ignore HTTPS errors in dev
    ignoreHTTPSErrors: true,

    // Locale & timezone
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },

  // ── Output folder for test artefacts ──────────────────────────────────────
  outputDir: 'qa-reports/test-results',

  // ── Global timeout ─────────────────────────────────────────────────────────
  timeout: 60_000,

  // ── Projects (browsers / viewports) ───────────────────────────────────────
  projects: [
    // ── Desktop Chrome ──────────────────────────────────────────────────────
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        channel: 'chromium',
      },
    },

    // ── Mobile Chrome (Samsung Galaxy S21) ──────────────────────────────────
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Galaxy S9+'],
      },
    },

    // ── Tablet (iPad) ────────────────────────────────────────────────────────
    {
      name: 'tablet',
      use: {
        ...devices['iPad (gen 7)'],
      },
    },
  ],

  // ── Web server: auto-start frontend dev server if not running ─────────────
  webServer: {
    command: 'npm run dev:frontend',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
