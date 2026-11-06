/**
 * Which prompts the management page and the chat ask for, against a real API.
 *
 * `GET /ai/prompts` answers the active prompts only, which is what the chat picker offers. A prompt
 * saved with "Aktiv" switched off therefore vanished from the management page, and its owner could not
 * switch it on again. nest-server 12.7.0 lists the disabled prompts on `?includeDisabled=true`;
 * nuxt-extensions 1.27.0 sends it for `load({ includeDisabled: true })` and keeps it for the reload
 * after a save. This spec checks the requests: every load of /app/settings/ai-prompts carries the
 * parameter, the first one and each reload after a save; the picker on /app/ai never does, and never
 * offers the disabled prompt. Which component passes which option is pinned by
 * `tests/unit/pages/ai-prompts-include-disabled.test.ts`.
 *
 * An API before 12.7.0 ignores the parameter. There the management page still loses the disabled
 * prompt, and the spec notes that as the annotation `api-before-12.7.0` instead of checking the row;
 * the requests are checked either way.
 *
 * Needs the API's AI module (`GET /ai/status` 200): the starter API leaves it off,
 * `NSC__AI__ENCRYPTION_SECRET` switches it on, as the `e2e-auth` CI jobs do. The spec skips without
 * the module, unless the run sets that variable: then a missing module is a fault, not a reason to
 * skip. See `docs/e2e-auth.md`.
 */

import { expect, test } from '@nuxt/test-utils/playwright';
import type { Page, Request, Response } from '@playwright/test';
import { fillInput, generateTestUser, gotoAndWaitForHydration, waitForURLAndHydration } from '@lenne.tech/nuxt-extensions/testing';

import { API_BASE, DEFAULT_FEATURES, FRONTEND_BASE, parseFeatures, resetTestData, waitForVerificationToken, type Features } from './helpers/auth-backend';

// =============================================================================
// UI Helpers
// =============================================================================

async function loginWithEmail(page: Page, email: string, password: string): Promise<void> {
  await gotoAndWaitForHydration(page, '/auth/login');
  await page.locator('input[name="email"]').waitFor({ state: 'visible', timeout: 10000 });
  await fillInput(page, 'input[name="email"]', email);
  await fillInput(page, 'input[name="password"]', password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
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
  }
  await waitForURLAndHydration(page, /\/app/, { timeout: 15000 });
}

/** A load of the prompt list: `GET …/ai/prompts`, through the dev proxy (`/api/ai/prompts`) too. */
function isPromptList(request: Request): boolean {
  return request.method() === 'GET' && new URL(request.url()).pathname.endsWith('/ai/prompts');
}

const isPromptListResponse = (response: Response): boolean => isPromptList(response.request());

/** The `includeDisabled` parameter of a prompt-list request, `null` when it has none. */
function includeDisabled(url: string): null | string {
  return new URL(url).searchParams.get('includeDisabled');
}

/** The names in a prompt-list answer. */
async function promptNames(response: Response): Promise<string[]> {
  expect(response.ok(), `GET ${response.url()} failed with ${response.status()}`).toBeTruthy();
  const body = (await response.json()) as Array<{ name?: string }>;
  return body.map((prompt) => prompt.name ?? '');
}

/** Fill the form on /app/settings/ai-prompts, save, and return the reload that follows. */
async function savePrompt(page: Page, name: string, options: { enabled: boolean }): Promise<Response> {
  await fillInput(page, '[data-test="prompt-name"]', name);
  await fillInput(page, '[data-test="prompt-content"]', `Inhalt von ${name}`);
  const active = page.getByRole('switch', { name: 'Aktiv' });
  if ((await active.getAttribute('aria-checked')) !== String(options.enabled)) {
    await active.click();
  }
  await expect(active).toHaveAttribute('aria-checked', String(options.enabled));

  const [reload] = await Promise.all([page.waitForResponse(isPromptListResponse), page.locator('[data-test="prompt-save"]').click()]);
  await expect(page.locator('[data-test="prompt-name"]')).toHaveValue('', { timeout: 10000 });
  return reload;
}

// =============================================================================
// Tests
// =============================================================================

let ready = false;
let aiEnabled = false;
let features: Features = { ...DEFAULT_FEATURES };

test.beforeAll(async ({ request }) => {
  try {
    ready = (await request.get(`${API_BASE}/`)).ok() && (await request.get(`${FRONTEND_BASE}/`)).ok();
  } catch {
    ready = false;
  }
  if (!ready) {
    console.error(`AI prompts E2E needs the API (${API_BASE}) and the app (${FRONTEND_BASE}) running — see docs/e2e-auth.md`);
    return;
  }

  const featuresResponse = await request.get(`${API_BASE}/iam/features`);
  expect(featuresResponse.ok(), `GET ${API_BASE}/iam/features failed with ${featuresResponse.status()}`).toBeTruthy();
  features = parseFeatures(await featuresResponse.json());

  aiEnabled = (await request.get(`${API_BASE}/ai/status`)).ok();
});

test.describe('AI prompts: the management lists disabled ones, the chat never offers them', () => {
  const user = generateTestUser('ai-prompts');

  test.afterAll(async () => {
    try {
      await resetTestData(user.email);
    } catch (error) {
      console.error(`  Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  test('the management asks for disabled prompts on every load, the chat picker never', async ({ page }) => {
    test.skip(!ready, 'Servers not running');
    if (process.env.NSC__AI__ENCRYPTION_SECRET) {
      expect(aiEnabled, `GET ${API_BASE}/ai/status does not answer 200 although this run sets NSC__AI__ENCRYPTION_SECRET`).toBe(true);
    }
    test.skip(!aiEnabled, 'The API runs without its AI module');

    const loads: string[] = [];
    page.on('request', (request) => {
      if (isPromptList(request)) loads.push(request.url());
    });

    const suffix = user.email.split('@')[0];
    const activeName = `E2E aktiv ${suffix}`;
    const disabledName = `E2E ausgeschaltet ${suffix}`;

    await resetTestData(user.email);
    await registerUser(page, user, features);

    await test.step('management: the first load and every reload after a save carry the parameter', async () => {
      const [first] = await Promise.all([page.waitForResponse(isPromptListResponse), gotoAndWaitForHydration(page, '/app/settings/ai-prompts')]);
      expect(includeDisabled(first.url())).toBe('true');

      const afterActive = await savePrompt(page, activeName, { enabled: true });
      expect(includeDisabled(afterActive.url())).toBe('true');
      expect(await promptNames(afterActive)).toContain(activeName);

      const afterDisabled = await savePrompt(page, disabledName, { enabled: false });
      expect(includeDisabled(afterDisabled.url())).toBe('true');

      // Exactly these three loads, all with the parameter: none went out without it.
      expect(loads.map(includeDisabled)).toEqual(['true', 'true', 'true']);

      if ((await promptNames(afterDisabled)).includes(disabledName)) {
        const row = page.locator('[data-test="prompt-row"]').filter({ hasText: disabledName });
        await expect(row).toBeVisible();
        await expect(row).toContainText('inaktiv');
      } else {
        test.info().annotations.push({
          description: 'The API ignored includeDisabled=true and left the disabled prompt out: nest-server before 12.7.0.',
          type: 'api-before-12.7.0',
        });
      }
    });

    await test.step('chat: the picker loads without the parameter and offers the active prompt only', async () => {
      loads.length = 0;
      const [pickerLoad] = await Promise.all([page.waitForResponse(isPromptListResponse), gotoAndWaitForHydration(page, '/app/ai')]);
      expect(includeDisabled(pickerLoad.url())).toBeNull();
      expect(await promptNames(pickerLoad)).not.toContain(disabledName);

      await page.locator('[data-test="ai-prompt-picker"]').click();
      const menu = page.getByRole('menu');
      await expect(menu.getByRole('menuitem', { name: activeName })).toBeVisible({ timeout: 10000 });
      await expect(menu.getByText(disabledName)).toHaveCount(0);

      expect(loads.map(includeDisabled)).toEqual([null]);
    });
  });
});
