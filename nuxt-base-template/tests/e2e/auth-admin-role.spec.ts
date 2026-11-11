/**
 * The admin area goes by the user's role, without Better Auth's admin plugin, against a real API.
 *
 * nest-server registers no `admin()` plugin, so every `admin.*` call of Better Auth's client answers
 * 404. Since 2.38.5 the template switches the client plugin off (`ltExtensions.auth.enableAdmin:
 * false`, pinned by `tests/unit/auth-admin-plugin-contract.test.ts`). What decides about
 * `/app/admin` is the role in the session: `app/middleware/admin.global.ts` with `isAdminUser`.
 *
 * This spec walks it: a user without the admin role signs in, opens the start page and the security
 * settings, and is sent from `/app/admin` back to `/app`. With the admin role granted and after a new
 * sign-in, `/app/admin` and `/app/admin/system` open. No request of the whole walk goes to
 * `/iam/admin/*`.
 *
 * The role is granted in the database (`grantAdminRole`), because a test user cannot grant itself one
 * through the API. Needs the API, the app and the API's MongoDB, see `docs/e2e-auth.md`.
 */

import { expect, test } from '@nuxt/test-utils/playwright';
import type { Page } from '@playwright/test';
import { fillInput, generateTestUser, gotoAndWaitForHydration, waitForURLAndHydration } from '@lenne.tech/nuxt-extensions/testing';

import { API_BASE, DEFAULT_FEATURES, FRONTEND_BASE, grantAdminRole, parseFeatures, resetTestData, waitForVerificationToken, type Features } from './helpers/auth-backend';
import { dropSession } from './helpers/session';

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

/** A request of Better Auth's admin plugin, directly or through the dev proxy (`/api/iam/admin/…`). */
function isAdminPluginRequest(url: string): boolean {
  return /\/iam\/admin(\/|$)/.test(new URL(url).pathname);
}

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
    console.error(`Admin role E2E needs the API (${API_BASE}) and the app (${FRONTEND_BASE}) running — see docs/e2e-auth.md`);
    return;
  }

  const featuresResponse = await request.get(`${API_BASE}/iam/features`);
  expect(featuresResponse.ok(), `GET ${API_BASE}/iam/features failed with ${featuresResponse.status()}`).toBeTruthy();
  features = parseFeatures(await featuresResponse.json());
});

test.describe('Admin area: the role decides, the admin plugin stays silent', () => {
  const user = generateTestUser('admin-role');

  test.afterAll(async () => {
    try {
      await resetTestData(user.email);
    } catch (error) {
      console.error(`  Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  test('without the role /app/admin leads to /app, with it the admin pages open, and no request goes to /iam/admin', async ({ page }) => {
    test.skip(!ready, 'Servers not running');

    const adminPluginRequests: string[] = [];
    page.context().on('request', (request) => {
      if (isAdminPluginRequest(request.url())) adminPluginRequests.push(`${request.method()} ${request.url()}`);
    });

    await resetTestData(user.email);
    await registerUser(page, user, features);

    await test.step('a user without the admin role: start page, security settings, no admin area', async () => {
      await gotoAndWaitForHydration(page, '/app');
      await expect(page.getByRole('heading', { level: 1, name: /Willkommen/ })).toBeVisible({ timeout: 10000 });

      await gotoAndWaitForHydration(page, '/app/settings/security');
      await expect(page.getByRole('heading', { level: 1, name: 'Sicherheit' })).toBeVisible({ timeout: 10000 });

      await gotoAndWaitForHydration(page, '/app/admin');
      await expect(page).toHaveURL(/\/app\/?$/, { timeout: 10000 });
      await expect(page.getByRole('heading', { level: 1, name: 'Administration' })).toHaveCount(0);
    });

    await test.step('with the admin role and a new sign-in: the admin pages open', async () => {
      await grantAdminRole(user.email);
      await dropSession(page);
      await loginWithEmail(page, user.email, user.password);

      await gotoAndWaitForHydration(page, '/app/admin');
      // Back on /app: the sign-in carried no admin role. Usually the API answered the roles from its
      // 15-second cache, which the database write does not reach; start it with PLAYWRIGHT=true.
      await expect(page, 'the new sign-in carries the admin role (API started with PLAYWRIGHT=true? see docs/e2e-auth.md)').toHaveURL(/\/app\/admin\/?$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Administration' })).toBeVisible({ timeout: 10000 });

      await gotoAndWaitForHydration(page, '/app/admin/system');
      await expect(page.getByRole('heading', { level: 1, name: 'System' })).toBeVisible({ timeout: 10000 });
    });

    expect(adminPluginRequests, 'Better Auth admin plugin requests (nest-server serves no /iam/admin routes)').toEqual([]);
  });
});
