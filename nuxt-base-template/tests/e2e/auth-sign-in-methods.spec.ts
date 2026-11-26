import { createHash } from 'node:crypto';

import type { Page } from '@playwright/test';

import type { Features } from './helpers/auth-backend';

import { expect, test } from '@nuxt/test-utils/playwright';
import { generateTestUser, gotoAndWaitForHydration } from '@lenne.tech/nuxt-extensions/testing';

import { socialProviderDisplay } from '../../app/utils/social-sign-in';
import { API_BASE, FRONTEND_BASE, parseFeatures, releaseSystemSetupClaim, resetTestData } from './helpers/auth-backend';

/**
 * The sign-in methods of the login page, against a REAL API: `GET /iam/features` decides what the page
 * offers, and the server HTML shows it already.
 *
 * - `emailAndPassword: false` (nest-server 12.11.0+, an API that signs in through providers alone): no
 *   form, no "Passwort vergessen?", no "Registrieren"; `/auth/register` and `/auth/forgot-password` send
 *   the visitor to the login. Without the field (an older API) the form stays.
 * - `passkey: false`: no passkey button. 12.11.0 reports it for provider-only sign-in by default.
 * - One button per provider in `socialProviders`, and a hint when no method is left at all.
 *
 * The spec runs against whatever the API is configured for. Against nest-server-starter as it ships
 * (`emailAndPassword` on) it checks that nothing changed. The provider-only case needs an API started
 * with
 *
 *   NSC__BETTER_AUTH__EMAIL_AND_PASSWORD__ENABLED=false
 *   NSC__BETTER_AUTH__SOCIAL_PROVIDERS__GITHUB__CLIENT_ID=<any value>
 *   NSC__BETTER_AUTH__SOCIAL_PROVIDERS__GITHUB__CLIENT_SECRET=<any value>
 *
 * (the button only starts the round trip, which this spec never takes, so the values need not be real).
 * With `E2E_SIGN_IN_CASE=providers-only` the spec fails instead of skipping when the API offers e-mail
 * and password after all: a run meant for that case must not report green without having seen it. The
 * CI job `e2e-auth` runs it once that way, on the empty database before the suite.
 *
 * Independent of the database state, as `register-ssr-features.spec.ts`: with zero users and the HTTP
 * init open, every page goes to `/auth/setup`, so the system is set up through the API when needed and
 * that admin is removed afterwards. With the HTTP init closed the pages stay reachable without a user.
 * The system setup creates its admin without Better Auth's e-mail sign-up, so it works with e-mail and
 * password off too.
 */

const PROVIDERS_ONLY = process.env.E2E_SIGN_IN_CASE === 'providers-only';

/** What the login page has to offer for `features`. */
function expectedMethods(features: Features) {
  const password = features.emailAndPassword !== false;
  const passkey = features.passkey !== false;
  return {
    forgotPassword: password,
    hint: !password && !passkey && features.socialProviders.length === 0,
    passkey,
    password,
    providers: features.socialProviders.map((id) => `Mit ${socialProviderDisplay(id).label} anmelden`),
    register: password && features.signUpEnabled !== false,
  };
}

/** Collects Vue's hydration warnings ("Hydration … mismatch") the page logs. */
function hydrationMessages(page: Page): string[] {
  const messages: string[] = [];
  page.on('console', (message) => {
    if (/hydration/i.test(message.text())) {
      messages.push(message.text());
    }
  });
  return messages;
}

test.describe('Sign-in methods follow /iam/features', () => {
  const admin = generateTestUser('sign-in-methods');
  let createdAdmin = false;
  let features: Features;

  test.beforeAll(async ({ request }) => {
    features = parseFeatures(await (await request.get(`${API_BASE}/iam/features`)).json());

    const status = (await (await request.get(`${API_BASE}/system-setup/status`)).json()) as { httpInitEnabled?: boolean; needsSetup?: boolean };
    if (status.needsSetup && status.httpInitEnabled !== false) {
      const res = await request.post(`${API_BASE}/system-setup/init`, {
        data: { email: admin.email, name: admin.name, password: createHash('sha256').update(admin.password).digest('hex') },
      });
      expect(res.ok(), `system setup failed: ${res.status()}`).toBe(true);
      createdAdmin = true;
    }
  });

  test.afterAll(async () => {
    if (createdAdmin) {
      await resetTestData(admin.email);
      // A successful init keeps its setup claim; without releasing it, the next run within five
      // minutes gets 403 from init although no user is left.
      await releaseSystemSetupClaim();
    }
  });

  test('the API runs the configuration this run asked for', () => {
    test.skip(!PROVIDERS_ONLY, 'E2E_SIGN_IN_CASE=providers-only is not set');

    expect(features.emailAndPassword, 'E2E_SIGN_IN_CASE=providers-only, but /iam/features reports e-mail and password on').toBe(false);
    expect(features.socialProviders.length, 'E2E_SIGN_IN_CASE=providers-only, but /iam/features lists no provider').toBeGreaterThan(0);
  });

  test('the server HTML of the login page offers exactly the methods the API reports', async ({ request }) => {
    const expected = expectedMethods(features);

    const res = await request.get(`${FRONTEND_BASE}/auth/login`, { headers: { 'Accept-Language': 'de' } });
    expect(res.ok()).toBe(true);
    expect(new URL(res.url()).pathname, 'must render the login page, not a redirect').toBe('/auth/login');
    const html = await res.text();

    const context = JSON.stringify(features);
    expect(html.includes('autocomplete="current-password"'), `password field, features ${context}`).toBe(expected.password);
    expect(html.includes('href="/auth/forgot-password"'), `"Passwort vergessen?", features ${context}`).toBe(expected.forgotPassword);
    expect(html.includes('href="/auth/register"'), `"Registrieren", features ${context}`).toBe(expected.register);
    expect(html.includes('Mit Passkey anmelden'), `passkey button, features ${context}`).toBe(expected.passkey);
    for (const label of expected.providers) {
      expect(html, `provider button, features ${context}`).toContain(label);
    }
    expect(html.includes('Anmeldung nicht möglich'), `hint, features ${context}`).toBe(expected.hint);
  });

  test('in the browser the page keeps those methods after hydration, without a mismatch', async ({ page }) => {
    const expected = expectedMethods(features);
    const hydration = hydrationMessages(page);

    await gotoAndWaitForHydration(page, '/auth/login');

    await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
    await expect(page.locator('input[autocomplete="current-password"]')).toHaveCount(expected.password ? 1 : 0);
    await expect(page.getByRole('link', { name: 'Passwort vergessen?' })).toHaveCount(expected.forgotPassword ? 1 : 0);
    await expect(page.getByRole('link', { name: 'Registrieren' })).toHaveCount(expected.register ? 1 : 0);
    await expect(page.getByRole('button', { name: 'Mit Passkey anmelden' })).toHaveCount(expected.passkey ? 1 : 0);
    for (const label of expected.providers) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }
    await expect(page.getByText('Anmeldung nicht möglich')).toHaveCount(expected.hint ? 1 : 0);
    expect(hydration).toEqual([]);
  });

  test('with e-mail and password off, the register page sends the visitor to the login and says why', async ({ page, request }) => {
    test.skip(features.emailAndPassword !== false, 'E-mail and password sign-in is on in the current config');

    // As with sign-up closed: a redirect issued by the server is a bare 302 without a payload, which
    // drops the toast. The page renders and leaves the redirect to the client.
    const res = await request.get(`${FRONTEND_BASE}/auth/register`, { maxRedirects: 0 });
    expect(res.status(), 'the server must not redirect').toBe(200);

    // Coming from another page, as from a bookmark or an old "Registrieren" link.
    await gotoAndWaitForHydration(page, '/');
    await page.goto('/auth/register');
    await expect(page.getByText('Registrierung nicht verfügbar').first()).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.locator('input[autocomplete="current-password"]')).toHaveCount(0);

    // The redirect replaces the history entry: "Back" leaves the auth pages instead of returning to
    // /auth/register, which would send the visitor to the login again, with one more toast each time.
    await page.goBack();
    await expect(page).toHaveURL(`${FRONTEND_BASE}/`);
  });

  test('with e-mail and password off, the forgot-password page sends the visitor to the login and says why', async ({ page, request }) => {
    test.skip(features.emailAndPassword !== false, 'E-mail and password sign-in is on in the current config');

    // There is no password to reset: the login page hides the link, a bookmark still lands here.
    const res = await request.get(`${FRONTEND_BASE}/auth/forgot-password`, { maxRedirects: 0 });
    expect(res.status(), 'the server must not redirect').toBe(200);

    await gotoAndWaitForHydration(page, '/');
    await page.goto('/auth/forgot-password');
    await expect(page.getByText('Passwort zurücksetzen nicht verfügbar').first()).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login$/);

    await page.goBack();
    await expect(page).toHaveURL(`${FRONTEND_BASE}/`);
  });
});
