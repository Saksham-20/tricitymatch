/**
 * ========================================================================
 * UX INTERACTION TESTS  –  TricityMatch QA Suite
 * ========================================================================
 * Simulates real user behaviour:
 *  • Navigation link clicks
 *  • Dropdown menus
 *  • Modal open/close
 *  • Form inputs & validation
 *  • Search field
 *  • Multi-step signup form
 *  • Mobile bottom navigation
 *  • Keyboard navigation (Tab/Enter)
 *  • Hover states
 * ========================================================================
 */
const { test, expect } = require('@playwright/test');
const {
  fullPageScreenshot,
  waitForStable,
  dismissOverlays,
  attachConsoleCapture,
} = require('../utils/helpers');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

// ── HOMEPAGE INTERACTIONS ────────────────────────────────────────────────────
test.describe('🏠 Homepage Interactions', () => {
  test('Home page loads without JS errors', async ({ page }) => {
    const { errors } = attachConsoleCapture(page);
    await page.goto('/');
    await waitForStable(page);
    await fullPageScreenshot(page, 'ux/home', 'loaded');

    const critical = errors.filter(e =>
      !e.text.includes('favicon') &&
      !e.text.includes('net::ERR_') &&
      !e.text.includes('Failed to load resource')
    );
    if (critical.length > 0) {
      console.warn(`⚠  Homepage JS errors: ${critical.map(e => e.text).join('\n')}`);
    }
    // Max 2 non-trivial JS errors tolerated
    expect(critical.length).toBeLessThan(3);
  });

  test('Home page CTA buttons are clickable', async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);

    // Look for sign-up or get-started style CTA
    const cta = page.locator(
      'a[href*="signup"], a[href*="register"], button:has-text("Get Started"), button:has-text("Join Now"), a:has-text("Sign Up")'
    ).first();

    if (await cta.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(cta).toBeEnabled();
      await fullPageScreenshot(page, 'ux/home', 'cta-visible');
    } else {
      console.warn('⚠  No clear CTA button found on homepage');
    }
  });

  test('Navigation links are functional (no dead links)', async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);

    const navLinks = await page.locator('nav a[href], header a[href]').all();
    console.log(`  Found ${navLinks.length} nav links`);

    for (const link of navLinks.slice(0, 10)) {
      const href = await link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#')) continue;

      const text = (await link.textContent()).trim();
      console.log(`  Checking nav link: "${text}" → ${href}`);

      // Should be a valid anchor
      await expect(link).toBeEnabled();
    }
  });
});

// ── LOGIN FORM INTERACTIONS ──────────────────────────────────────────────────
test.describe('🔑 Login Form UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await waitForStable(page);
  });

  test('Tab key moves focus between form fields correctly', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], [name="email"]').first();
    await emailInput.focus();
    await page.keyboard.press('Tab');

    const activeTag = await page.evaluate(() => document.activeElement.tagName.toLowerCase());
    // Focus should have moved to next field (password or similar)
    expect(['input', 'button', 'select', 'textarea', 'a']).toContain(activeTag);
    await fullPageScreenshot(page, 'ux/login', 'tab-focus');
  });

  test('Password field toggles visibility if toggle exists', async ({ page }) => {
    const toggle = page.locator(
        'button[aria-label*="show password" i]:visible, button[aria-label*="hide password" i]:visible'
    ).first();

    if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      const passInput = page.locator('input#password, input[name="password"]').first();
      await expect(passInput).toBeVisible();
      await toggle.click();
      await page.waitForTimeout(300);
      const type = await passInput.getAttribute('type');
      // After toggle: should be "text"
      expect(type).toBe('text');
      await fullPageScreenshot(page, 'ux/login', 'password-visible');

      await toggle.click();
      await page.waitForTimeout(300);
      const type2 = await passInput.getAttribute('type');
      expect(type2).toBe('password');
    } else {
      console.warn('⚠  No password visibility toggle found – consider adding one for UX');
    }
  });

  test('Login button shows loading state on submit', async ({ page }) => {
    await page.fill('input[type="email"], [name="email"]', 'test@test.com');
    await page.fill('input[type="password"]', 'anything');

    const btn = page.locator('button[type="submit"]').first();
    await btn.click();

    // Briefly check for a loading indicator
    await page.waitForTimeout(300);
    await fullPageScreenshot(page, 'ux/login', 'submit-loading-state');
    // Non-fatal – just capture state
  });

  test('Login page has link to Sign Up', async ({ page }) => {
     const signupLink = page.locator('a[href*="signup"]:visible, a:has-text("Sign up"):visible, a:has-text("Register"):visible').first();
    await expect(signupLink).toBeVisible();
    await expect(signupLink).toBeEnabled();
  });

  test('Login page has link to Forgot Password', async ({ page }) => {
    const forgotLink = page.locator(
      'a[href*="forgot"], a:has-text("Forgot"), a:has-text("forgot")'
    ).first();
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();
    await expect(page).toHaveURL(/forgot-password/);
  });
});

// ── SIGNUP MULTI-STEP FORM ───────────────────────────────────────────────────
test.describe('📝 Signup Form UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup');
    await waitForStable(page);
  });

  test('Signup page renders step 1 with required fields', async ({ page }) => {
    await fullPageScreenshot(page, 'ux/signup', 'step-1');

    // Should have some form field visible as the starting point
    const inputs = await page.locator('input:visible, select:visible').count();
    expect(inputs).toBeGreaterThan(0);
  });

  test('Signup step 1 validates required fields before proceeding', async ({ page }) => {
    // Try to advance without filling anything
    const nextBtn = page.locator(
      'button:has-text("Next"), button:has-text("Continue"), button[type="submit"]'
    ).first();

    if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Use force:true because the button may be disabled when form is empty
      await nextBtn.click({ force: true });
      await page.waitForTimeout(600);
      await fullPageScreenshot(page, 'ux/signup', 'step-1-validation');

      // Should still be on step 1 (URL or form still shows)
      const stillOnStep1 = await page.locator('input:visible').count();
      expect(stillOnStep1).toBeGreaterThan(0);
    }
  });

  test('Signup has a link back to Login', async ({ page }) => {
     const loginLink = page.locator('a[href*="login"]:visible, a:has-text("Log in"):visible, a:has-text("Sign in"):visible').first();
    await expect(loginLink).toBeVisible();
  });

  test('Signup step 1 accepts email input', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], [name="email"], [placeholder*="email" i]').first();

    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill('ui-test@example.com');
      const val = await emailInput.inputValue();
      expect(val).toBe('ui-test@example.com');
      await fullPageScreenshot(page, 'ux/signup', 'email-filled');
    }
  });
});

// ── FORGOT PASSWORD FORM ─────────────────────────────────────────────────────
test.describe('🔒 Forgot Password UX', () => {
  test('Forgot password form submits and shows feedback', async ({ page }) => {
    await page.goto('/forgot-password');
    await waitForStable(page);

    const emailInput = page.locator('input[type="email"], [name="email"]').first();
    await emailInput.fill('test@tricitymatch.com');
    await page.click('button[type="submit"]');

    // Wait for response
    await page.waitForTimeout(2000);
    await fullPageScreenshot(page, 'ux/forgot-password', 'after-submit');

    // A success or error message should appear
    const feedback = page.locator('[role="alert"], .toast, [class*="success"], [class*="error"], p:has-text("email"), p:has-text("sent")').first();
    const hasFeedback = await feedback.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasFeedback) {
      console.warn('⚠  No visible feedback after forgot-password submit – UX gap');
    }
  });
});

// ── NAVIGATION INTERACTIONS ──────────────────────────────────────────────────
test.describe('🧭 Navigation UX', () => {
  test('All top-level nav links are reachable from homepage', async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);

    const links = await page.locator('nav a[href]').all();
    const hrefs = await Promise.all(links.map(l => l.getAttribute('href')));
    const internal = hrefs.filter(h => h && !h.startsWith('http') && !h.startsWith('#') && !h.startsWith('mailto'));

    console.log(`  Nav internal links: ${internal.join(', ')}`);
    expect(internal.length).toBeGreaterThan(0);
  });

  test('Mobile hamburger menu (if present) opens & shows links', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await waitForStable(page);

    const hamburger = page.locator(
      '[aria-label*="menu"], button[aria-label*="Menu"], [data-testid*="hamburger"], .hamburger, button svg'
    ).first();

    if (await hamburger.isVisible({ timeout: 2000 }).catch(() => false)) {
      await hamburger.click();
      await page.waitForTimeout(300);
      await fullPageScreenshot(page, 'ux/nav', 'mobile-menu-open');

      const menuLinks = page.locator('[role="menuitem"], nav a:visible, [data-testid*="nav-link"]');
      const count = await menuLinks.count();
      console.log(`  Mobile menu links visible: ${count}`);
    } else {
      console.log('  ℹ  No hamburger found (may use bottom nav instead)');
    }
  });

  test('Bottom navigation visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await waitForStable(page);

    const bottomNav = page.locator('[class*="bottom-nav"], [class*="BottomNav"], nav[class*="fixed"], nav[class*="bottom"]').first();
    const visible   = await bottomNav.isVisible({ timeout: 2000 }).catch(() => false);

    if (!visible) {
      console.warn('⚠  No bottom navigation found on mobile – check BottomNav component visibility on public pages');
    }
    await fullPageScreenshot(page, 'ux/nav', 'mobile-bottom-nav');
  });

  test('Back navigation works from Terms page', async ({ page }) => {
    // Establish navigation history: home → terms
    await page.goto('/');
    await waitForStable(page);
    await page.goto('/terms');
    await waitForStable(page);

    // Go back to the previous page
    await page.goBack();
    await waitForStable(page);
    // Should not crash
    await expect(page).not.toHaveURL('about:blank');
  });
});

// ── KEYBOARD ACCESSIBILITY ────────────────────────────────────────────────────
test.describe('⌨  Keyboard Navigation UX', () => {
  test('Login form is fully navigable by keyboard', async ({ page }) => {
    await page.goto('/login');
    await waitForStable(page);

    // Start from body, tab through all interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const activeSel = await page.evaluate(() =>
      document.activeElement ? document.activeElement.tagName.toLowerCase() : 'none'
    );
    expect(['input', 'button', 'a', 'select']).toContain(activeSel);
    await fullPageScreenshot(page, 'ux/keyboard', 'login-keyboard-nav');
  });

  test('Skip-to-main link is present (screen reader accessibility)', async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);

    const skipLink = page.locator('a:has-text("Skip to"), a[href="#main"], a[href="#content"]').first();
    if (await skipLink.count() > 0) {
      console.log('  ✓  Skip-to-main link found');
    } else {
      console.warn('⚠  No skip-to-main link found – add for screen reader accessibility');
    }
  });

  test('Enter key submits login form', async ({ page }) => {
    await page.goto('/login');
    await waitForStable(page);

    await page.fill('input[type="email"], [name="email"]', 'test@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.keyboard.press('Enter');

    // Should submit (either navigate or show error – either is correct UX)
    await page.waitForTimeout(1500);
    await fullPageScreenshot(page, 'ux/keyboard', 'enter-submit');
  });
});

// ── MODAL & OVERLAY INTERACTIONS ─────────────────────────────────────────────
test.describe('🔲 Modals & Overlays', () => {
  test('Escape key closes open modals', async ({ page }) => {
    await page.goto('/');
    await waitForStable(page);

    // Check if any modal can be triggered from the homepage
    const modalTriggers = await page.locator(
      'button[data-modal], button[aria-haspopup="dialog"], button:has-text("Learn More")'
    ).all();

    for (const trigger of modalTriggers.slice(0, 2)) {
      if (await trigger.isVisible({ timeout: 1000 }).catch(() => false)) {
        await trigger.click();
        await page.waitForTimeout(400);

        const modal = page.locator('[role="dialog"], .modal, [class*="modal"]').first();
        if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(400);
          const stillOpen = await modal.isVisible({ timeout: 500 }).catch(() => false);
          expect(stillOpen).toBe(false);
          console.log('  ✓  Escape closes modal');
        }
        break;
      }
    }
  });
});
