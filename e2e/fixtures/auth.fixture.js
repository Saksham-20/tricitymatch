/**
 * Playwright auth fixture
 * Provides pre-authenticated pages for protected-route tests.
 * Uses storageState to reuse cookies/localStorage across tests.
 */
const { test: base, expect } = require('@playwright/test');
const path  = require('path');
const fs    = require('fs');

// Path where we persist the auth session
const AUTH_STATE_PATH = path.join(__dirname, '../.auth/user.json');

/**
 * Ensure the .auth directory exists
 */
function ensureAuthDir() {
  const dir = path.dirname(AUTH_STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Global setup helper – call this from a global-setup.js OR from the first test
 * in each suite to create the auth state file.
 */
async function saveAuthState(page) {
  ensureAuthDir();
  await page.context().storageState({ path: AUTH_STATE_PATH });
}

/**
 * Extended test fixture that provides:
 *  - `page`  – unauthenticated page (standard)
 *  - `authedPage` – page already logged in as test user
 */
const test = base.extend({
  // Authenticated page via storageState
  authedPage: async ({ browser }, use) => {
    ensureAuthDir();
    const hasSession = fs.existsSync(AUTH_STATE_PATH);
    const ctx = await browser.newContext(
      hasSession ? { storageState: AUTH_STATE_PATH } : {}
    );
    const page = await ctx.newPage();

    if (!hasSession) {
      // Perform live login and save state
      await page.goto('/login');
      await page.fill('[data-testid="email-input"], input[type="email"]', process.env.TEST_USER_EMAIL || 'test@tricitymatch.com');
      await page.fill('[data-testid="password-input"], input[type="password"]', process.env.TEST_USER_PASSWORD || 'Test@123456');
      await page.click('[data-testid="login-btn"], button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 15_000 });
      await ctx.storageState({ path: AUTH_STATE_PATH });
    }

    await use(page);
    await ctx.close();
  },
});

module.exports = { test, expect, saveAuthState, AUTH_STATE_PATH };
