/**
 * Server-rendered HTML never carries the internal API address.
 *
 * The app reaches the API at two addresses. The browser uses `NUXT_PUBLIC_API_URL`. The app server
 * uses `NUXT_API_URL` during SSR, and on a cluster that is an internal name (`http://api:3000`) no
 * browser can resolve. `buildLtApiUrl()` returns the internal address during SSR. That is right for a
 * request the server sends itself and wrong for every URL that ends up in the page: an `<img src>` or
 * a download link built with it points the browser at an address it cannot reach, so the image never
 * loads. A project on the stack lost its images in production that way. File URLs for the page come
 * from `useLtFile().getFileUrl()` / `getDownloadUrl()` (nuxt-extensions 4.0.0), which use the public
 * address on the server too.
 *
 * This spec renders every page under `app/pages` that has no route parameter: signed out, signed in,
 * and as admin. It fails when the server-rendered HTML, the Nuxt payload included, contains the host
 * of `NUXT_API_URL`. A page added later is covered without a change here. It needs the internal host
 * to differ from the public one: the CI job starts the app with `NUXT_API_URL=http://127.0.0.1:3000`
 * next to `NUXT_PUBLIC_API_URL=http://localhost:3000`, two names for the same API (in an
 * `lt fullstack` monorepo that is the root CI, see `docs/e2e-auth.md`). With one address for both
 * (`lt dev up`, a local run without `NUXT_API_URL`) it skips, because it could not tell them apart.
 *
 * Needs the API (with `PLAYWRIGHT=true` for the admin role), the app and the API's MongoDB, see
 * `docs/e2e-auth.md`.
 */

import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@nuxt/test-utils/playwright';
import type { Page } from '@playwright/test';
import { fillInput, generateTestUser, gotoAndWaitForHydration, waitForURLAndHydration } from '@lenne.tech/nuxt-extensions/testing';

import { API_BASE, DEFAULT_FEATURES, FRONTEND_BASE, grantAdminRole, parseFeatures, resetTestData, waitForVerificationToken, type Features } from './helpers/auth-backend';
import { dropSession } from './helpers/session';

// =============================================================================
// Pages and addresses
// =============================================================================

const PAGES_DIR = fileURLToPath(new URL('../../app/pages', import.meta.url));

/** The route of every page without a parameter: `index.vue` stands for its directory, route groups `(x)` vanish. */
function staticRoutes(dir: string = PAGES_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      if (entry.name.includes('[')) return [];
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return staticRoutes(path);
      if (!entry.name.endsWith('.vue')) return [];
      const segments = relative(PAGES_DIR, path)
        .replace(/\.vue$/, '')
        .split(sep)
        .filter((segment) => !/^\(.*\)$/.test(segment));
      if (segments.at(-1) === 'index') segments.pop();
      return [`/${segments.join('/')}`];
    })
    .sort();
}

function hostOf(url: string | undefined): string {
  try {
    return url ? new URL(url).host : '';
  } catch {
    return '';
  }
}

const ROUTES = staticRoutes();
/** Where the app server reaches the API during SSR. Only this test process sees it, as the app server does. */
const INTERNAL_HOST = hostOf(process.env.NUXT_API_URL);
const PUBLIC_HOSTS = [hostOf(API_BASE), hostOf(FRONTEND_BASE)];
/** Only a host that occurs in no public address can be searched for in the HTML. */
const DISTINCT = INTERNAL_HOST !== '' && PUBLIC_HOSTS.every((host) => !host.includes(INTERNAL_HOST));

interface Rendered {
  /** Path the request ended on after the app's redirects. */
  path: string;
  route: string;
  status: number;
}

/**
 * Request every route the way a browser's first load does (the context's cookies, redirects
 * followed) and return the routes whose HTML contains the internal host, plus where each one ended.
 */
async function sweep(page: Page): Promise<{ leaks: string[]; rendered: Rendered[] }> {
  const leaks: string[] = [];
  const rendered: Rendered[] = [];
  for (const route of ROUTES) {
    const response = await page.request.get(new URL(route, FRONTEND_BASE).href);
    const html = await response.text();
    rendered.push({ path: new URL(response.url()).pathname, route, status: response.status() });
    if (html.includes(INTERNAL_HOST)) {
      const at = html.indexOf(INTERNAL_HOST);
      leaks.push(`${route}: …${html.slice(Math.max(0, at - 80), at + INTERNAL_HOST.length + 40)}…`);
    }
  }
  return { leaks, rendered };
}

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

// =============================================================================
// Tests
// =============================================================================

let ready = false;
let features: Features = { ...DEFAULT_FEATURES };

test.beforeAll(async ({ request }) => {
  if (!DISTINCT) return;
  try {
    ready = (await request.get(`${API_BASE}/`)).ok() && (await request.get(`${FRONTEND_BASE}/`)).ok();
  } catch {
    ready = false;
  }
  if (!ready) {
    console.error(`SSR address E2E needs the API (${API_BASE}) and the app (${FRONTEND_BASE}) running — see docs/e2e-auth.md`);
    return;
  }

  const featuresResponse = await request.get(`${API_BASE}/iam/features`);
  expect(featuresResponse.ok(), `GET ${API_BASE}/iam/features failed with ${featuresResponse.status()}`).toBeTruthy();
  features = parseFeatures(await featuresResponse.json());
});

test.describe('SSR: the internal API address never reaches the HTML', () => {
  const user = generateTestUser('ssr-address');

  test.afterAll(async () => {
    if (!ready) return;
    try {
      await resetTestData(user.email);
    } catch (error) {
      console.error(`  Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  test('no page renders the host of NUXT_API_URL, signed out, signed in or as admin', async ({ page }) => {
    test.skip(!DISTINCT, 'NUXT_API_URL is unset or names a public host: start the app with an internal address of its own (CI: http://127.0.0.1:3000)');
    test.skip(!ready, 'Servers not running');

    // A sweep over nothing would pass: the directory walk has to find the pages.
    expect(ROUTES, 'static routes under app/pages').toEqual(expect.arrayContaining(['/', '/auth/login']));

    for (const [label, prepare] of [
      ['signed out', async () => {}],
      [
        'signed in',
        async () => {
          await resetTestData(user.email);
          await registerUser(page, user, features);
        },
      ],
      [
        'as admin',
        async () => {
          await grantAdminRole(user.email);
          await dropSession(page);
          await loginWithEmail(page, user.email, user.password);
        },
      ],
    ] as const) {
      await test.step(label, async () => {
        await prepare();
        const { leaks, rendered } = await sweep(page);

        expect(
          rendered.filter(({ status }) => status !== 200),
          `${label}: every page renders`,
        ).toEqual([]);
        // The sweep has to reach the pages it is meant for, or it proves nothing about them. Checked
        // where the project has the page: a project without an admin area sweeps the rest all the same.
        const landedOn = (route: string): string | undefined => rendered.find((entry) => entry.route === route)?.path;
        if (ROUTES.includes('/app')) {
          if (label === 'signed out') expect(landedOn('/app'), 'signed out, /app leads to the login').toBe('/auth/login');
          if (label === 'signed in') expect(landedOn('/app'), 'signed in, /app renders').toBe('/app');
        }
        if (label === 'as admin' && ROUTES.includes('/app/admin')) {
          expect(landedOn('/app/admin'), 'as admin, /app/admin renders (API started with PLAYWRIGHT=true?)').toBe('/app/admin');
        }

        expect(leaks, `${label}: HTML with the internal API host ${INTERNAL_HOST}`).toEqual([]);
      });
    }
  });
});
