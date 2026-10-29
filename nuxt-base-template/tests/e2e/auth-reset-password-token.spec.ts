import type { Page } from '@playwright/test';

import { expect, test } from '@nuxt/test-utils/playwright';

import { fillInput, gotoAndWaitForHydration, waitForHydration } from '@lenne.tech/nuxt-extensions/testing';

/**
 * Regression guard for DEV-3871: a fresh password-reset link reported "Link nicht mehr
 * gültig" without sending a single request.
 *
 * The page strips the token from the address bar once it is in hand (it would otherwise survive
 * in browser history). Anything that loaded the page a second time — a reload, Back/Forward, a
 * restored tab — therefore found no token and declared a perfectly valid link dead. The page now
 * keeps the token per tab for as long as the form is open; these tests pin both halves: the
 * token survives a second load, and it does NOT survive once it has been used or rejected.
 *
 * The reset endpoint is stubbed: what matters here is which token the page sends and what it
 * shows afterwards. Redeeming a real token is `auth-lifecycle.spec.ts` Step 9.
 */

const PASSWORD = 'NeuesPasswort123!';

interface ResetStub {
  /** Tokens of every reset request the page sent, in order. */
  sentTokens: string[];
}

/**
 * Answer `POST …/reset-password` with the given Better Auth response.
 *
 * Filtered by method, because the page itself lives at `/auth/reset-password` and its document
 * request must reach the server untouched.
 */
async function stubResetEndpoint(page: Page, response: { body: unknown; status: number }): Promise<ResetStub> {
  const stub: ResetStub = { sentTokens: [] };
  await page.route('**/reset-password', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    stub.sentTokens.push(JSON.parse(route.request().postData() ?? '{}').token);
    await route.fulfill({ body: JSON.stringify(response.body), contentType: 'application/json', status: response.status });
  });
  return stub;
}

async function submitNewPassword(page: Page): Promise<void> {
  await fillInput(page, 'input[name="password"]', PASSWORD);
  await fillInput(page, 'input[name="confirmPassword"]', PASSWORD);
  await page.getByRole('button', { name: 'Passwort speichern' }).click();
}

async function reload(page: Page): Promise<void> {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForHydration(page);
}

test.describe('Reset-password link (DEV-3871)', () => {
  test('keeps a valid link usable after the page is reloaded', async ({ page }) => {
    const stub = await stubResetEndpoint(page, { body: { status: true }, status: 200 });

    await gotoAndWaitForHydration(page, '/auth/reset-password?token=first-load-token');

    // The token still leaves the address bar — the fix must not undo that hardening.
    await expect(page).toHaveURL(/\/auth\/reset-password$/);

    await reload(page);

    await expect(page.getByText('Link nicht mehr gültig')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Passwort speichern' })).toBeEnabled();

    await submitNewPassword(page);
    await expect(page.getByRole('heading', { name: 'Passwort zurückgesetzt' })).toBeVisible();
    expect(stub.sentTokens).toEqual(['first-load-token']);
  });

  test('forgets the token once the password has been set', async ({ page }) => {
    await stubResetEndpoint(page, { body: { status: true }, status: 200 });

    await gotoAndWaitForHydration(page, '/auth/reset-password?token=used-token');
    await submitNewPassword(page);
    await expect(page.getByRole('heading', { name: 'Passwort zurückgesetzt' })).toBeVisible();

    await reload(page);

    // A used token is dead; offering the form again would only produce a failure on submit.
    await expect(page.getByText('Link nicht mehr gültig')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Passwort speichern' })).toBeDisabled();
  });

  test('forgets the token once the server has rejected it', async ({ page }) => {
    await stubResetEndpoint(page, { body: { code: 'INVALID_TOKEN', message: 'Invalid token' }, status: 400 });

    await gotoAndWaitForHydration(page, '/auth/reset-password?token=rejected-token');
    await submitNewPassword(page);
    await expect(page.getByText('Link nicht mehr gültig')).toBeVisible();

    await reload(page);

    await expect(page.getByText('Link nicht mehr gültig')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Passwort speichern' })).toBeDisabled();
  });

  test('keeps the token after a failure that is not about the link', async ({ page }) => {
    const stub = await stubResetEndpoint(page, { body: { message: 'Too many requests' }, status: 429 });

    await gotoAndWaitForHydration(page, '/auth/reset-password?token=retry-token');
    await submitNewPassword(page);
    await expect(page.getByText('Gerade nicht möglich')).toBeVisible();

    await reload(page);

    // A rate limit or a server hiccup says nothing about the link — a retry must still work.
    await expect(page.getByRole('button', { name: 'Passwort speichern' })).toBeEnabled();
    await submitNewPassword(page);
    // Polled: the click returns before validation, hashing and the request have run, and the
    // alert from the first attempt is still on screen, so there is nothing visible to wait for.
    await expect.poll(() => stub.sentTokens).toEqual(['retry-token', 'retry-token']);
  });

  test('does not hand the token to whoever opens the page next in that tab', async ({ page }) => {
    await gotoAndWaitForHydration(page, '/auth/reset-password?token=abandoned-token');

    // Typed URL: a fresh document load that is neither a reload nor Back/Forward.
    await gotoAndWaitForHydration(page, '/auth/reset-password');

    await expect(page.getByText('Link nicht mehr gültig')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Passwort speichern' })).toBeDisabled();
  });

  test('forgets the token when the form is left inside the app', async ({ page }) => {
    await gotoAndWaitForHydration(page, '/auth/reset-password?token=left-token');

    await page.getByRole('link', { name: 'Neuen Link anfordern' }).click();
    await expect(page).toHaveURL(/\/auth\/forgot-password$/);
    await page.goBack();

    // vue-router rewrites the entry it leaves from its own state; that once restored the token.
    await expect(page).toHaveURL(/\/auth\/reset-password$/);
    await expect(page.getByText('Link nicht mehr gültig')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Passwort speichern' })).toBeDisabled();
  });

  test('uses the newest link when a second one is opened in the same tab', async ({ page }) => {
    const stub = await stubResetEndpoint(page, { body: { status: true }, status: 200 });

    await gotoAndWaitForHydration(page, '/auth/reset-password?token=older-token');
    await gotoAndWaitForHydration(page, '/auth/reset-password?token=newer-token');

    await submitNewPassword(page);
    await expect(page.getByRole('heading', { name: 'Passwort zurückgesetzt' })).toBeVisible();
    expect(stub.sentTokens).toEqual(['newer-token']);
  });

  test('still reports a link without a token as invalid', async ({ page }) => {
    await gotoAndWaitForHydration(page, '/auth/reset-password');

    await expect(page.getByText('Link nicht mehr gültig')).toBeVisible();
    await expect(page.getByText('ungültig oder fehlt')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Passwort speichern' })).toBeDisabled();
  });
});
