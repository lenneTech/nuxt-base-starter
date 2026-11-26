import type { Page } from '@playwright/test';

import type { Features } from './helpers/auth-backend';

import { expect, test } from '@nuxt/test-utils/playwright';
import { fillInput, generateTestUser, gotoAndWaitForHydration, waitForHydration, waitForURLAndHydration } from '@lenne.tech/nuxt-extensions/testing';

import { API_BASE, DEFAULT_FEATURES, FRONTEND_BASE, parseFeatures, resetTestData, waitForVerificationToken } from './helpers/auth-backend';

/**
 * A session the API ended sends the visitor to the login on the next protected request.
 *
 * Since nuxt-extensions 4.0.6, `validateSession()` signs out a cached user once a direct
 * `get-session` confirms that the API has no session for them; the layout calls it on every load and
 * ignores its result. 4.0.6 then left the visitor stranded: the page showed them signed out, and the
 * 401 interceptor ignored the next 401, because nobody was signed in any more. Every request failed,
 * and no redirect came until the visitor navigated. nuxt-extensions 4.0.7 hands that 401 to the
 * interceptor again, which checks the session and sends the browser to
 * `/auth/login?redirect=<the page>` (found by ng-base, 22.1.4 carries the same case).
 *
 * That state needs an API without JWT (`/iam/features` reports `jwt: false`, nest-server with
 * `betterAuth.jwt.enabled: false`). With JWT on, the app switches to JWT mode after the first page
 * load and keeps the JWT, `validateSession()` keeps the user while one is stored, and the next 401
 * reaches the interceptor with somebody signed in: the redirect came in 4.0.6 too (measured
 * 2026-11-25). So the spec checks the redirect against every API, and the signed-out page in between
 * only where it occurs. The e2e-auth job runs it once more against an API without JWT
 * (`NSC__BETTER_AUTH__JWT__ENABLED=false`) with `E2E_SESSION_CASE=no-jwt`, which makes the spec fail
 * instead of passing without the decisive step when the API reports JWT on after all.
 *
 * The session is ended where an expired or revoked session ends, on the API: `POST /iam/sign-out`
 * with the browser's session cookie, from a request context of its own, so the browser keeps its
 * cookies and its cached user. The protected request is `GET /users/:id` (`S_USER`), sent from the
 * page with the browser's `fetch`, which the interceptor wraps; `/iam/*` would not do, the interceptor
 * leaves the auth routes alone.
 *
 * Cookie mode only: a JWT-only API (`E2E_EXPECT_AUTH_MODE=jwt`) authenticates the request by the
 * bearer the app adds, which a bare `fetch` from the test does not carry.
 */

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
    await page.getByRole('checkbox', { name: /akzeptiere die AGB/i }).check();
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
    await page.getByRole('button', { name: 'Später einrichten' }).click();
    await waitForURLAndHydration(page, /\/app/, { timeout: 15000 });
  }
}

/** Sends `GET /users/:id` from the page, as the app's next request would; its answer status, or `null` when the page left first. */
async function protectedRequestStatus(page: Page, userId: string): Promise<null | number> {
  try {
    return await page.evaluate(async (url) => (await fetch(url, { credentials: 'include' })).status, `${API_BASE}/users/${userId}`);
  } catch {
    // The interceptor navigated away while the request was answered.
    return null;
  }
}

let features: Features = { ...DEFAULT_FEATURES };

test.beforeAll(async ({ request }) => {
  features = parseFeatures(await (await request.get(`${API_BASE}/iam/features`)).json());
});

test.describe('A session the API ended', () => {
  const user = generateTestUser('session-ended');

  test.afterAll(async () => {
    await resetTestData(user.email);
  });

  test('sends the visitor to the login on the next protected request, back to the page afterwards', async ({ page, playwright }) => {
    test.skip(process.env.E2E_EXPECT_AUTH_MODE?.trim().toLowerCase() === 'jwt', 'Cookie mode only: the request from the test carries no bearer');

    if (process.env.E2E_SESSION_CASE === 'no-jwt') {
      expect(features.jwt, 'E2E_SESSION_CASE=no-jwt, but /iam/features reports JWT on').toBe(false);
    }

    await resetTestData(user.email);
    await registerUser(page, user, features);
    await gotoAndWaitForHydration(page, '/app');
    await expect(page.getByLabel('Abmelden', { exact: true }).first()).toBeVisible();

    const session = (await (await page.request.get(`${API_BASE}/iam/get-session`)).json()) as { user?: { id?: string } } | null;
    const userId = session?.user?.id;
    expect(userId, 'get-session with the browser cookies returns the user').toBeTruthy();
    expect(await protectedRequestStatus(page, userId!), 'the protected request works while the session lives').toBe(200);

    await test.step('the API ends the session; the browser keeps its cookies', async () => {
      const cookieHeader = (await page.context().cookies(API_BASE)).map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
      const api = await playwright.request.newContext();
      const signOut = await api.post(`${API_BASE}/iam/sign-out`, { data: {}, headers: { Cookie: cookieHeader, Origin: FRONTEND_BASE } });
      expect(signOut.ok(), `sign-out answered ${signOut.status()}`).toBe(true);
      const gone = (await (await api.get(`${API_BASE}/iam/get-session`, { headers: { Cookie: cookieHeader } })).json()) as { session?: unknown } | null;
      expect(gone?.session ?? null, 'the API has no session for the cookie any more').toBeNull();
      await api.dispose();
    });

    await test.step('after a reload the page stays on /app (without JWT: signed out)', async () => {
      await page.reload();
      await waitForHydration(page);
      if (features.jwt === false) {
        await expect(page.getByRole('link', { name: 'Anmelden' }).first()).toBeVisible({ timeout: 15000 });
      }
      await expect(page).toHaveURL(/\/app\/?$/);
    });

    await test.step('the next protected request leads to the login, with the way back', async () => {
      await protectedRequestStatus(page, userId!);
      await expect(page).toHaveURL(`${FRONTEND_BASE}/auth/login?redirect=%2Fapp`, { timeout: 15000 });
    });
  });
});
