import { expect, test } from '@nuxt/test-utils/playwright';

// Regression guard for the capture-phase preventDefault attached in
// pages/auth/login.vue + pages/auth/register.vue. A racey/early submit (typed
// password + Enter before Vue hydration is fully wired) must NOT cause the
// native form GET that would leak credentials into the URL.
test.describe('Auth form hardening', () => {
  test('login page does not native-GET-submit even on a very fast Enter', async ({ goto, page }) => {
    await goto('/auth/login', { waitUntil: 'domcontentloaded' });
    // Fill + immediately press Enter — the worst case race window.
    await page.locator('input[type="email"]').fill('race@test.com');
    await page.locator('input[type="password"]').fill('SuperSecret123!');
    await page.locator('input[type="password"]').press('Enter');
    // No native navigation with credentials in the URL.
    await page.waitForTimeout(50);
    await expect(page).not.toHaveURL(/password=/);
  });

  test('register page does not native-GET-submit either', async ({ goto, page }) => {
    await goto('/auth/register', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill('race-register@test.com');
    await page.locator('input[type="password"]').first().fill('SuperSecret123!');
    await page.locator('input[type="password"]').nth(1).fill('SuperSecret123!');
    await page.locator('input[type="password"]').nth(1).press('Enter');
    await page.waitForTimeout(50);
    await expect(page).not.toHaveURL(/password=/);
  });
});
