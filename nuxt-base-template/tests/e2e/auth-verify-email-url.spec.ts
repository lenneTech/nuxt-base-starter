/**
 * `/auth/verify-email` keeps the e-mail address and the token out of the URL.
 *
 * Login and sign-up used to send visitors there with `?email=…`, and the link in the verification
 * mail carries `?token=…&email=…` (nest-server builds it). In the address bar both went to analytics,
 * into the referrer of links, into the browser history and into every link somebody pasted. The page
 * now takes the address from the history entry and moves both out of the URL the moment it has read
 * them. A reload keeps what the page needs: the address for "send a new e-mail", and the outcome of an
 * accepted link.
 *
 * Checked on `history.state` too, not only on `location.href`: vue-router writes the location it
 * knows into `back` and `current`, and a check of the address bar alone misses that.
 *
 * Prerequisites: see `docs/e2e-auth.md`. Skips without e-mail verification on the API.
 */
import type { Page } from '@playwright/test';

import { expect, test } from '@nuxt/test-utils/playwright';
import { fillInput, generateTestUser, gotoAndWaitForHydration, waitForURLAndHydration } from '@lenne.tech/nuxt-extensions/testing';

import { API_BASE, DEFAULT_FEATURES, FRONTEND_BASE, parseFeatures, resetTestData, waitForVerificationToken, type Features } from './helpers/auth-backend';

let available = false;
let features: Features = { ...DEFAULT_FEATURES };

/** The URL and every location vue-router keeps in the history entry. */
async function locations(page: Page): Promise<string> {
  return page.evaluate(() => {
    const state = (window.history.state ?? {}) as Record<string, unknown>;
    return JSON.stringify([window.location.href, state.back, state.current, state.forward]);
  });
}

async function expectNoSecrets(page: Page, ...secrets: string[]): Promise<void> {
  const seen = await locations(page);
  for (const secret of secrets) {
    expect(seen).not.toContain(secret);
    expect(seen).not.toContain(encodeURIComponent(secret));
  }
}

test.beforeAll(async ({ request }) => {
  try {
    available = (await request.get(`${API_BASE}/`)).ok() && (await request.get(`${FRONTEND_BASE}/`)).ok();
    if (available) {
      features = parseFeatures(await (await request.get(`${API_BASE}/iam/features`)).json());
    }
  } catch {
    available = false;
  }
});

test.describe.serial('verify-email keeps the address and the token out of the URL', () => {
  const user = generateTestUser('verify-email-url');

  test.beforeEach(() => {
    test.skip(!available, 'Servers not running');
    test.skip(!features.emailVerification, 'E-mail verification is off on this API');
  });

  test.afterAll(async () => {
    await resetTestData(user.email);
  });

  test('sign-up hands the address over without putting it into the URL', async ({ page }) => {
    await gotoAndWaitForHydration(page, '/auth/register');
    await fillInput(page, 'input[name="name"]', user.name);
    await fillInput(page, 'input[name="email"]', user.email);
    await fillInput(page, 'input[name="password"]', user.password);
    await fillInput(page, 'input[name="confirmPassword"]', user.password);
    if (features.signUpChecks) {
      await page.getByRole('checkbox', { name: /akzeptiere die AGB/i }).check();
    }
    await page.getByRole('button', { name: 'Konto erstellen' }).click();
    await waitForURLAndHydration(page, /\/auth\/verify-email/, { timeout: 15000 });

    await expect(page.getByText(user.email)).toBeVisible();
    await expect(page.getByRole('button', { name: /Bestätigungs-E-Mail erneut senden/ })).toBeVisible();
    await expectNoSecrets(page, user.email);

    // The history entry keeps the address across a reload, the URL still does not carry it.
    await page.reload();
    await expect(page.getByText(user.email)).toBeVisible();
    await expectNoSecrets(page, user.email);
  });

  test('the link from the mail loses token and address on arrival, and a reload still confirms', async ({ page }) => {
    const token = await waitForVerificationToken(user.email);
    expect(token, 'Verification token not found in server logs').not.toBeNull();

    // As nest-server builds it.
    await gotoAndWaitForHydration(page, `/auth/verify-email?token=${token}&email=${encodeURIComponent(user.email)}`);
    await expect(page.getByRole('heading', { name: 'E-Mail bestätigt' })).toBeVisible({ timeout: 15000 });
    await expectNoSecrets(page, token ?? '', user.email);

    // Before any reload: the first in-app navigation writes `back` from the router's own copy of the
    // location, and Back restores the entry's URL. A raw `history.replaceState` leaves that copy on
    // the old URL, and a reload would rebuild it from the clean address bar and hide the leak.
    await page.getByRole('link', { name: 'Jetzt anmelden' }).click();
    await waitForURLAndHydration(page, /\/auth\/login/);
    await expectNoSecrets(page, token ?? '', user.email);

    await page.goBack();
    await expect(page).toHaveURL(/\/auth\/verify-email$/);
    await expect(page.getByRole('heading', { name: 'E-Mail bestätigt' })).toBeVisible();
    await expectNoSecrets(page, token ?? '', user.email);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'E-Mail bestätigt' })).toBeVisible();
    await expectNoSecrets(page, token ?? '', user.email);

    await page.getByRole('link', { name: 'Jetzt anmelden' }).click();
    await waitForURLAndHydration(page, /\/auth\/login/);
    await expectNoSecrets(page, token ?? '', user.email);
  });
});
