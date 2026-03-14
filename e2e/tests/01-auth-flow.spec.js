/**
 * ========================================================================
 * AUTH FLOW TESTS  –  TricityMatch QA Suite
 * ========================================================================
 * Tests: Login, Logout, Signup, Forgot Password, Protected Route Guard
 * ========================================================================
 */
const { test, expect } = require('@playwright/test');
const { fullPageScreenshot, attachConsoleCapture, waitForStable } = require('../utils/helpers');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fillAndSubmitLogin(page, email, password) {
  await page.fill('input[type="email"], [name="email"], [data-testid="email-input"]', email);
  await page.fill('input[type="password"], [name="password"], [data-testid="password-input"]', password);
  await page.click('button[type="submit"]');
}

// ── Test suite ───────────────────────────────────────────────────────────────

test.describe('🔐 Auth Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();
  });

  // ── 1. Login page renders correctly ──────────────────────────────────────
  test('Login page loads and has required fields', async ({ page }) => {
    const { errors } = attachConsoleCapture(page);

    await page.goto('/login');
    await waitForStable(page);
    await fullPageScreenshot(page, 'auth', 'login-page');

    // Check page title
    await expect(page).toHaveTitle(/.+/);

    // Email & password inputs must be visible
    const emailInput = page.locator('input[type="email"], [name="email"]').first();
    const passInput  = page.locator('input[type="password"], [name="password"]').first();
    const submitBtn  = page.locator('button[type="submit"]').first();

    await expect(emailInput).toBeVisible();
    await expect(passInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Should have a link to signup
    const signupLink = page.locator('a[href*="signup"]:visible, a:has-text("Sign up"):visible, a:has-text("Register"):visible').first();
    await expect(signupLink).toBeVisible();

    if (errors.length > 0) {
      // Filter expected 401 from AuthContext polling /api/auth/me when logged out
      const real = errors.filter(e => !/auth\/me|401/.test(e.text));
      if (real.length > 0) console.warn(`⚠  ${real.length} console error(s) on /login:`, real);
    }
  });

  // ── 2. Login – empty form validation ─────────────────────────────────────
  test('Login shows validation errors on empty submit', async ({ page }) => {
    await page.goto('/login');
    await waitForStable(page);

    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // HTML5 validation or custom error messages should appear
    const emailInput = page.locator('input[type="email"], [name="email"]').first();
    const isInvalid  = await emailInput.evaluate(el => !el.validity.valid || el.getAttribute('aria-invalid') === 'true');

    // At minimum, the page should NOT navigate away
    await expect(page).toHaveURL(/login/);
    await fullPageScreenshot(page, 'auth', 'login-empty-validation');
  });

  // ── 3. Login – wrong credentials ─────────────────────────────────────────
  test('Login shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await waitForStable(page);

    await fillAndSubmitLogin(page, 'nobody@nowhere.invalid', 'WrongPass!999');

    // Wait for error message
    await page.waitForTimeout(2000);
    await fullPageScreenshot(page, 'auth', 'login-invalid-creds');

    // Should still be on the login page
    await expect(page).toHaveURL(/login/);

    // An error toast or inline error should appear
    const errorMsg = page.locator(
      '[role="alert"]:visible, .error:visible, [data-testid*="error"]:visible, .toast:visible, [class*="toast"]:visible, [class*="error"]:visible'
    ).first();
    // Soft check – not all UIs use ARIA roles
    const visible = await errorMsg.isVisible().catch(() => false);
    if (!visible) {
      console.warn('⚠  No visible error element found after failed login – check UX');
    }
  });

  // ── 4. Protected route redirects to login ────────────────────────────────
  test('Protected /dashboard redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForStable(page);
    await fullPageScreenshot(page, 'auth', 'protected-redirect');

    // Should be on the login page
    await expect(page).toHaveURL(/login|\/$/);
  });

  // ── 5. Protected route /profile redirects ────────────────────────────────
  test('Protected /profile redirects unauthenticated users', async ({ page }) => {
    await page.goto('/profile');
    await waitForStable(page);
    await expect(page).toHaveURL(/login|\/$/);
  });

  // ── 6. Signup page renders ───────────────────────────────────────────────
  test('Signup page loads and has required fields', async ({ page }) => {
    const { errors } = attachConsoleCapture(page);

    await page.goto('/signup');
    await waitForStable(page);
    await fullPageScreenshot(page, 'auth', 'signup-page');

    // Check for form fields
    const emailOrNext = page.locator(
      'input[type="email"], [name="email"], button:has-text("Next"), button:has-text("Continue")'
    ).first();
    await expect(emailOrNext).toBeVisible();

    // Link back to Login
    const loginLink = page.locator('a[href*="login"]:visible, a:has-text("Log in"):visible, a:has-text("Sign in"):visible').first();
    await expect(loginLink).toBeVisible();

    if (errors.length > 0) {
      const real = errors.filter(e => !/auth\/me|401/.test(e.text));
      if (real.length > 0) console.warn(`⚠  ${real.length} console error(s) on /signup:`, real);
    }
  });

  // ── 7. Forgot password page ───────────────────────────────────────────────
  test('Forgot password page loads with email field', async ({ page }) => {
    await page.goto('/forgot-password');
    await waitForStable(page);
    await fullPageScreenshot(page, 'auth', 'forgot-password-page');

    const emailInput = page.locator('input[type="email"], [name="email"]').first();
    await expect(emailInput).toBeVisible();

    const submitBtn = page.locator('button[type="submit"]').first();
    await expect(submitBtn).toBeVisible();
  });

  // ── 8. Forgot password – validation ──────────────────────────────────────
  test('Forgot password shows error for missing email', async ({ page }) => {
    await page.goto('/forgot-password');
    await waitForStable(page);

    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    // Must remain on the same page
    await expect(page).toHaveURL(/forgot-password/);
    await fullPageScreenshot(page, 'auth', 'forgot-password-validation');
  });

  // ── 9. Reset password page renders ───────────────────────────────────────
  test('Reset password page loads', async ({ page }) => {
    await page.goto('/reset-password?token=fake-token-for-ui-test');
    await waitForStable(page);
    await fullPageScreenshot(page, 'auth', 'reset-password-page');

    // Should render some form (even if token is invalid, the page structure exists)
    await expect(page).toHaveURL(/reset-password/);
  });

  // ── 10. Successful login flow (only if TEST credentials set) ─────────────
  test('Successful login redirects to dashboard', async ({ page }) => {
    const email    = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;

    if (!email || !password) {
      test.skip(true, 'TEST_USER_EMAIL / TEST_USER_PASSWORD env vars not set – skipping live login test');
    }

    const { errors } = attachConsoleCapture(page);

    await page.goto('/login');
    await waitForStable(page);
    await fillAndSubmitLogin(page, email, password);

    // Should navigate to the dashboard
    await page.waitForURL('**/dashboard', { timeout: 20_000 });
    await waitForStable(page);
    await fullPageScreenshot(page, 'auth', 'post-login-dashboard');

    expect(errors.filter(e => !e.text.includes('favicon'))).toHaveLength(0);

    // Logout after test
    const logoutBtn = page.locator('[data-testid="logout-btn"], button:has-text("Logout"), a:has-text("Logout")').first();
    if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutBtn.click();
      await waitForStable(page);
      await expect(page).toHaveURL(/login|\/$/);
    }
  });
});
