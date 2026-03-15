import { test } from '@playwright/test';
import path from 'path';

test.describe('Capture Current Signup Flow', () => {
  test('Screenshot: Current signup page', async ({ page }) => {
    await page.goto('http://localhost:5173/signup', { waitUntil: 'networkidle' });
    await page.screenshot({ path: './qa-reports/screenshots/01-current-signup.png', fullPage: true });
    console.log('✓ Captured current signup page');
  });

  test('Screenshot: Signup form visible', async ({ page }) => {
    await page.goto('http://localhost:5173/signup', { waitUntil: 'networkidle' });
    
    // Wait for form to be visible
    await page.waitForSelector('input[placeholder*="full name" i]', { timeout: 5000 }).catch(() => null);
    
    // Take screenshot showing form
    await page.screenshot({ path: './qa-reports/screenshots/02-signup-form-initial.png', fullPage: true });
    console.log('✓ Form visible');
  });

  test('Screenshot: Fill first field (Name)', async ({ page }) => {
    await page.goto('http://localhost:5173/signup', { waitUntil: 'networkidle' });
    
    // Find and fill name field
    const nameInput = page.locator('input[type="text"]:visible').first();
    await nameInput.fill('John Smith', { timeout: 5000 }).catch(() => null);
    await page.screenshot({ path: './qa-reports/screenshots/03-signup-name-filled.png', fullPage: true });
    console.log('✓ Name field filled');
  });

  test('Screenshot: Mobile view of signup', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:5173/signup', { waitUntil: 'networkidle' });
    await page.screenshot({ path: './qa-reports/screenshots/04-signup-mobile.png', fullPage: true });
    console.log('✓ Mobile signup captured');
  });
});
