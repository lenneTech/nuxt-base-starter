/**
 * The login page works without a mouse.
 *
 * "Passwort vergessen?" sits in the label row of the password field. It used to carry
 * `tabindex="-1"`, so Tab skipped it, and a keyboard or switch user could reach the reset flow only by
 * typing its URL (WCAG 2.1.1). Now it is the next stop after the email field, where it is placed
 * visually, and Enter follows it. `tests/unit/keyboard-reachable-controls.test.ts` catches the
 * attribute on any link or button without a browser.
 *
 * Needs the API and the app, see `docs/e2e-auth.md`: the login page reads `GET /iam/features`.
 */

import { expect, test } from '@nuxt/test-utils/playwright';
import { gotoAndWaitForHydration, waitForURLAndHydration } from '@lenne.tech/nuxt-extensions/testing';

import { API_BASE, FRONTEND_BASE } from './helpers/auth-backend';

let ready = false;

test.beforeAll(async ({ request }) => {
  try {
    ready = (await request.get(`${API_BASE}/`)).ok() && (await request.get(`${FRONTEND_BASE}/`)).ok();
  } catch {
    ready = false;
  }
  if (!ready) {
    console.error(`Keyboard E2E needs the API (${API_BASE}) and the app (${FRONTEND_BASE}) running — see docs/e2e-auth.md`);
  }
});

test.describe('Login page by keyboard', () => {
  test('"Passwort vergessen?" is the next Tab stop after the email field, and Enter opens it', async ({ page }) => {
    test.skip(!ready, 'Servers not running');

    await gotoAndWaitForHydration(page, '/auth/login');
    const email = page.locator('input[name="email"]');
    await email.waitFor({ state: 'visible', timeout: 10000 });
    await email.focus();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Passwort vergessen?' })).toBeFocused();

    await page.keyboard.press('Enter');
    await waitForURLAndHydration(page, /\/auth\/forgot-password/, { timeout: 10000 });
  });
});
