/**
 * /app/admin/system says so when the API does not report its build, and lets the admin retry.
 *
 * The page compares the commit the App runs with the one the API reports through `GET /meta`, to
 * spot a partial or stale rollout. A failed `/meta` used to leave the API commit at `unknown`, and
 * the drift check stays silent for `unknown` on purpose (a local build has no commit). So an API
 * outage looked exactly like a local build: no error and no way to ask again, on the one page meant
 * to show a broken rollout (found in a project's browser walk, 2026-11-11).
 *
 * `GET /meta` is made to fail with a route in the browser; the API itself stays up. The account gets
 * the admin role in the database, which the API sees only when started with `PLAYWRIGHT=true` (its
 * 15-second role cache is off then), see docs/e2e-auth.md.
 */

import { expect, test } from '@nuxt/test-utils/playwright';
import type { Page, Route } from '@playwright/test';
import { fillInput, generateTestUser, gotoAndWaitForHydration, waitForURLAndHydration } from '@lenne.tech/nuxt-extensions/testing';

import { API_BASE, DEFAULT_FEATURES, FRONTEND_BASE, grantAdminRole, parseFeatures, resetTestData, waitForVerificationToken, type Features } from './helpers/auth-backend';

// =============================================================================
// UI Helpers
// =============================================================================

async function loginWithEmail(page: Page, email: string, password: string): Promise<void> {
  await gotoAndWaitForHydration(page, '/auth/login');
  await page.locator('input[name="email"]').waitFor({ state: 'visible', timeout: 10000 });
  await fillInput(page, 'input[name="email"]', email);
  await fillInput(page, 'input[name="password"]', password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await waitForURLAndHydration(page, /\/app/, { timeout: 15000 });
}

/** Register through the UI and end signed in on /app, whatever the backend scenario. */
async function registerUser(page: Page, user: { email: string; name: string; password: string }, features: Features): Promise<void> {
  await gotoAndWaitForHydration(page, '/auth/register');
  await page.locator('input[name="name"]').waitFor({ state: 'visible', timeout: 10000 });
  await fillInput(page, 'input[name="name"]', user.name);
  await fillInput(page, 'input[name="email"]', user.email);
  await fillInput(page, 'input[name="password"]', user.password);
  await fillInput(page, 'input[name="confirmPassword"]', user.password);

  if (features.signUpChecks) {
    const termsCheckbox = page.getByRole('checkbox', { name: /akzeptiere die AGB/i });
    await termsCheckbox.waitFor({ state: 'visible', timeout: 5000 });
    await termsCheckbox.check();
  }

  await page.getByRole('button', { name: 'Konto erstellen' }).click();

  if (features.emailVerification) {
    await waitForURLAndHydration(page, /\/auth\/verify-email/, { timeout: 15000 });
    const token = await waitForVerificationToken(user.email);
    expect(token, 'Verification token not found in server logs').not.toBeNull();
    await gotoAndWaitForHydration(page, `/auth/verify-email?token=${token}`);
    await expect(page.getByRole('heading', { name: 'E-Mail bestätigt' })).toBeVisible({ timeout: 15000 });
    await loginWithEmail(page, user.email, user.password);
  } else {
    const laterButton = page.getByRole('button', { name: 'Später einrichten' });
    await laterButton.waitFor({ state: 'visible', timeout: 10000 });
    await laterButton.click();
    await waitForURLAndHydration(page, /\/app/, { timeout: 15000 });
  }
}

/** `GET /meta` of the API, directly or through the dev proxy (`/api/meta`). */
const isMetaRequest = (url: URL): boolean => url.pathname.endsWith('/meta');

// =============================================================================
// Tests
// =============================================================================

let ready = false;
let features: Features = { ...DEFAULT_FEATURES };

test.beforeAll(async ({ request }) => {
  try {
    ready = (await request.get(`${API_BASE}/`)).ok() && (await request.get(`${FRONTEND_BASE}/`)).ok();
  } catch {
    ready = false;
  }
  if (!ready) {
    console.error(`System page E2E needs the API (${API_BASE}) and the app (${FRONTEND_BASE}) running — see docs/e2e-auth.md`);
    return;
  }

  const featuresResponse = await request.get(`${API_BASE}/iam/features`);
  expect(featuresResponse.ok(), `GET ${API_BASE}/iam/features failed with ${featuresResponse.status()}`).toBeTruthy();
  features = parseFeatures(await featuresResponse.json());
});

test.describe('Admin system page: an API that does not report its build', () => {
  const user = generateTestUser('admin-system');

  test.afterAll(async () => {
    try {
      await resetTestData(user.email);
    } catch (error) {
      console.error(`  Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  test('a failed GET /meta shows an error with a retry, a failed retry says so, and a successful one recovers', async ({ page }) => {
    test.skip(!ready, 'Servers not running');

    await resetTestData(user.email);
    await registerUser(page, user, features);
    await grantAdminRole(user.email);
    await page.context().clearCookies();
    await loginWithEmail(page, user.email, user.password);

    let failMeta = true;
    await page.route(isMetaRequest, async (route: Route) =>
      failMeta ? route.fulfill({ body: JSON.stringify({ message: 'down' }), contentType: 'application/json', status: 503 }) : route.continue(),
    );

    await gotoAndWaitForHydration(page, '/app/admin/system');
    await expect(page, 'the sign-in carries the admin role (API started with PLAYWRIGHT=true? see docs/e2e-auth.md)').toHaveURL(/\/app\/admin\/system$/);

    const failed = page.getByTestId('system-api-failed');
    await expect(failed).toContainText('API-Build nicht abrufbar', { timeout: 10000 });
    // No drift warning and no commit for the API: "unknown" is not what the API reported.
    await expect(page.getByText('App und API laufen auf unterschiedlichen Builds')).toHaveCount(0);
    await expect(page.getByTestId('system-api-commit')).toHaveCount(0);

    // A retry that fails as well says so, with the time: in an outage the answer comes back at once,
    // and an unchanged page would read as a button that does nothing.
    const retry = page.getByRole('button', { name: 'Erneut versuchen' });
    await retry.click();
    await expect(failed).toContainText(/Letzter Versuch um \d{2}:\d{2}:\d{2} Uhr: weiterhin keine Antwort\./);
    await expect(retry, 'the busy button keeps the keyboard focus').toBeFocused();

    failMeta = false;
    await retry.click();
    await expect(failed).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByTestId('system-api-commit')).toBeVisible();
    // The focused button went with the alert; focus lands on the API figures, not on <body>.
    await expect(page.getByRole('heading', { name: 'API (Backend)' })).toBeFocused();
  });
});
