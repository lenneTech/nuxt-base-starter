/**
 * A file uploaded through the template's TUS endpoint is served at the URL nuxt-extensions builds.
 *
 * `ltExtensions.tus.defaultEndpoint` is `/tus`, which nuxt-extensions resolves against the API
 * (`tests/unit/tus-endpoint-contract.test.ts`). The response that completes an upload carries the
 * stored file's id in `X-File-Id`, which `useLtTusUpload()` hands on as `item.fileId`. Since
 * nuxt-extensions 4.0.0, `useLtFile().getFileUrl(id)` and `getDownloadUrl(id)` point at
 * nest-server's `GET /files/id/:id` on the API (DEV-4073). Before, they built `/files/<id>`, which
 * nest-server reads as a file NAME and answers 404, so every link to an uploaded file was dead.
 *
 * The template renders no file link itself, and the composables cannot be called from a test. So
 * this walks the chain with the requests `tus-js-client` sends: create the upload, send the bytes,
 * read `X-File-Id`, fetch `/files/id/<id>` with the owner's session, without one, and with another
 * user's session. It needs the API, the app and the API's MongoDB, see `docs/e2e-auth.md`. The few
 * bytes it uploads stay in the test database: nest-server stores them in GridFS, on disk or in S3,
 * depending on its configuration.
 *
 * The other user matters most. nest-server-starter lets every signed-in user reach the route
 * (`file.downloadRoles: [S_USER]`) and decides per file in `FileService.checkRights()`: own file, or
 * ADMIN. nest-server's own `checkRights()` allows every file, so an API that widens the role gate
 * without a per-file rule (`file.access: 'owner'` or its own `checkRights()`) serves every user's
 * files to everybody who signs up. The owner and the anonymous request cannot tell the two apart.
 */

import { expect, test } from '@nuxt/test-utils/playwright';
import type { Page } from '@playwright/test';
import { fillInput, generateTestUser, gotoAndWaitForHydration, waitForURLAndHydration } from '@lenne.tech/nuxt-extensions/testing';

import { API_BASE, DEFAULT_FEATURES, FRONTEND_BASE, parseFeatures, resetTestData, waitForVerificationToken, type Features } from './helpers/auth-backend';
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

/** TUS `Upload-Metadata`: comma-separated `key base64(value)` pairs, as tus-js-client writes them. */
function tusMetadata(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([key, value]) => `${key} ${Buffer.from(value, 'utf8').toString('base64')}`)
    .join(',');
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
    console.error(`File link E2E needs the API (${API_BASE}) and the app (${FRONTEND_BASE}) running — see docs/e2e-auth.md`);
    return;
  }

  const featuresResponse = await request.get(`${API_BASE}/iam/features`);
  expect(featuresResponse.ok(), `GET ${API_BASE}/iam/features failed with ${featuresResponse.status()}`).toBeTruthy();
  features = parseFeatures(await featuresResponse.json());
});

test.describe('File links: an upload through the TUS endpoint is served at /files/id/:id', () => {
  const user = generateTestUser('file-link');
  const other = generateTestUser('file-link-other');

  test.afterAll(async () => {
    for (const email of [user.email, other.email]) {
      try {
        await resetTestData(email);
      } catch (error) {
        console.error(`  Cleanup failed for ${email}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });

  test('the id from X-File-Id opens the file for its owner, and neither without a session nor for another user', async ({ page, playwright }) => {
    test.skip(!ready, 'Servers not running');

    const content = `nuxt-base-starter file link check ${user.email}\n`;
    const filename = 'e2e-file-link.txt';

    await resetTestData(user.email);
    await resetTestData(other.email);
    await registerUser(page, user, features);

    // The template's endpoint, resolved against the API the way nuxt-extensions resolves it.
    const create = await page.request.post(`${API_BASE}/tus`, {
      headers: {
        Origin: FRONTEND_BASE,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(Buffer.byteLength(content)),
        'Upload-Metadata': tusMetadata({ filename, filetype: 'text/plain' }),
      },
    });
    expect(create.status(), `POST ${API_BASE}/tus`).toBe(201);
    const location = create.headers()['location'];
    expect(location, 'Location of the created upload').toBeTruthy();

    const finish = await page.request.patch(new URL(location ?? '', `${API_BASE}/`).href, {
      data: Buffer.from(content, 'utf8'),
      headers: {
        'Content-Type': 'application/offset+octet-stream',
        Origin: FRONTEND_BASE,
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': '0',
      },
    });
    expect(finish.status(), 'PATCH that completes the upload').toBe(204);
    const fileId = finish.headers()['x-file-id'];
    expect(fileId, 'X-File-Id of the stored file (nest-server 12.x)').toMatch(/^[a-f\d]{24}$/);

    // The URL nuxt-extensions 4.0.0 builds for getFileUrl(fileId) and getDownloadUrl(fileId).
    const fileUrl = `${API_BASE}/files/id/${fileId}`;
    const download = await page.request.get(fileUrl);
    expect(download.status(), `GET ${fileUrl} with the user's session`).toBe(200);
    expect(await download.text()).toBe(content);

    // The link is no public URL: without a session the API refuses it.
    const anonymous = await playwright.request.newContext();
    try {
      const refused = await anonymous.get(fileUrl);
      expect(refused.status(), `GET ${fileUrl} without a session`).not.toBe(200);
      expect(await refused.text()).not.toContain(content);
    } finally {
      await anonymous.dispose();
    }

    // Signed in is not enough either: another user's session is refused too. This is the line that
    // fails on an API that widened `file.downloadRoles` without a per-file rule (see the header).
    await dropSession(page);
    await registerUser(page, other, features);
    const foreign = await page.request.get(fileUrl);
    expect(foreign.status(), `GET ${fileUrl} with another user's session`).not.toBe(200);
    expect(await foreign.text()).not.toContain(content);
  });
});
