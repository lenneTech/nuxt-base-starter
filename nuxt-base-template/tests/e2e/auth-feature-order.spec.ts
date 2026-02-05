import { expect, test } from '@nuxt/test-utils/playwright';
import type { Page } from '@playwright/test';
import * as fs from 'node:fs';
import { extractTOTPSecret, fillInput, generateTestUser, generateTOTP, gotoAndWaitForHydration, waitForURLAndHydration } from '@lenne.tech/nuxt-extensions/testing';

/**
 * Authentication E2E Tests - Feature Ordering & Error Translations
 *
 * Tests:
 * - Test 1: Register → 2FA → Passkey (without logout) - order independence
 * - Test 2: Register → Passkey → 2FA (without logout) - order independence
 * - Test 3: Error Translations (German error messages, i18n endpoint)
 *
 * Automatically detects backend configuration via /iam/features.
 *
 * Requirements:
 * - API: nest-server-starter OR nest-server running on port 3000
 *        (stdout redirected to /tmp/nest-server.log or NEST_SERVER_LOG)
 * - Frontend: nuxt-base-starter running on port 3001
 *
 * See auth-lifecycle.spec.ts for full documentation on backend options,
 * configuration scenarios, and how to run against all 4 configurations.
 *
 * Run: npx playwright test tests/e2e/auth-feature-order.spec.ts
 */

// =============================================================================
// Types
// =============================================================================

interface Features {
  emailVerification: boolean;
  enabled: boolean;
  jwt: boolean;
  passkey: boolean;
  signUpChecks: boolean;
  twoFactor: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const API_BASE = 'http://localhost:3000';
const FRONTEND_BASE = 'http://localhost:3001';

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract email verification token from backend server logs.
 * The nest-server logs: [EMAIL VERIFICATION] User: <email>, URL: ...?token=<jwt>
 */
function getVerificationTokenFromLog(email: string): string | null {
  const logPath = process.env.NEST_SERVER_LOG || '/tmp/nest-server.log';
  try {
    const log = fs.readFileSync(logPath, 'utf-8');
    const regex = new RegExp(`\\[EMAIL VERIFICATION\\] User: ${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, URL: .+?token=([^&\\s]+)`);
    const match = log.match(regex);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Register a new user via UI.
 * Adapts to current configuration (terms checkbox, email verification).
 */
async function registerUser(page: Page, user: { email: string; password: string; name: string }, features: Features): Promise<void> {
  await gotoAndWaitForHydration(page, '/auth/register');
  await page.locator('input[name="name"]').waitFor({ state: 'visible', timeout: 10000 });

  await fillInput(page, 'input[name="name"]', user.name);
  await fillInput(page, 'input[name="email"]', user.email);
  await fillInput(page, 'input[name="password"]', user.password);
  await fillInput(page, 'input[name="confirmPassword"]', user.password);

  // Accept terms if signUpChecks is enabled
  if (features.signUpChecks) {
    const termsCheckbox = page.getByRole('checkbox', { name: /akzeptiere die AGB/i });
    await termsCheckbox.waitFor({ state: 'visible', timeout: 5000 });
    await termsCheckbox.check();
  }

  await page.getByRole('button', { name: 'Konto erstellen' }).click();

  if (features.emailVerification) {
    // Wait for redirect to verify-email page
    await waitForURLAndHydration(page, /\/auth\/verify-email/, { timeout: 15000 });

    // Extract token from backend logs and verify email
    let token: string | null = null;
    for (let i = 0; i < 10; i++) {
      token = getVerificationTokenFromLog(user.email);
      if (token) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    expect(token, 'Verification token not found in server logs').not.toBeNull();

    await gotoAndWaitForHydration(page, `/auth/verify-email?token=${token}`);
    await expect(page.getByRole('heading', { name: 'E-Mail bestätigt' })).toBeVisible({ timeout: 15000 });

    // Login after verification
    await page.getByRole('link', { name: 'Jetzt anmelden' }).click();
    await waitForURLAndHydration(page, /\/auth\/login/, { timeout: 10000 });
    await loginWithEmail(page, user.email, user.password);
    await waitForURLAndHydration(page, /\/app/, { timeout: 15000 });
  } else {
    // Wait for passkey prompt and dismiss it
    const laterButton = page.getByRole('button', { name: 'Später einrichten' });
    await laterButton.waitFor({ state: 'visible', timeout: 10000 });
    await laterButton.click();
    await waitForURLAndHydration(page, /\/app/, { timeout: 15000 });
  }
}

/**
 * Login with email and password via UI
 */
async function loginWithEmail(page: Page, email: string, password: string): Promise<void> {
  await gotoAndWaitForHydration(page, '/auth/login');
  await page.locator('input[name="email"]').waitFor({ state: 'visible', timeout: 10000 });
  await fillInput(page, 'input[name="email"]', email);
  await fillInput(page, 'input[name="password"]', password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
}

/**
 * Enable 2FA and return the TOTP secret.
 * Uses network interception to extract the TOTP URI (QR code is SVG via v-html).
 */
async function enable2FA(page: Page, password: string): Promise<string> {
  await gotoAndWaitForHydration(page, '/app/settings/security');

  const enableButton = page.getByRole('button', { name: '2FA aktivieren' });
  await enableButton.waitFor({ state: 'visible', timeout: 10000 });

  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.click();
  await page.keyboard.type(password, { delay: 5 });

  // Intercept the 2FA enable response to extract TOTP URI
  const responsePromise = page.waitForResponse((resp) => resp.url().includes('/two-factor/enable') && resp.status() === 200);

  await enableButton.click();

  const response = await responsePromise;
  const responseBody = await response.json();
  const totpUri = responseBody.totpURI || responseBody.data?.totpURI;
  expect(totpUri, '2FA enable response should contain totpURI').toBeTruthy();

  const secret = extractTOTPSecret(totpUri);
  expect(secret).not.toBeNull();

  // Wait for QR code SVG to render
  await page.locator('.bg-white svg').waitFor({ state: 'visible', timeout: 10000 });

  // Verify TOTP
  const totpCode = generateTOTP(secret!);
  await fillInput(page, 'input[placeholder="000000"]', totpCode);
  await page.getByRole('button', { name: 'Verifizieren' }).click();

  // Close backup codes dialog
  await expect(page.getByRole('heading', { name: 'Backup-Codes' })).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('Escape');

  return secret!;
}

/**
 * Cleanup Virtual Authenticator
 */
async function cleanupAuthenticator(cdpSession: any, authenticatorId: string): Promise<void> {
  try {
    await cdpSession.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
    await cdpSession.send('WebAuthn.disable');
  } catch {
    // Ignore cleanup errors
  }
}

// =============================================================================
// API Availability & Feature Detection
// =============================================================================

let apiAvailable = false;
let features: Features | null = null;

test.beforeAll(async ({ request }) => {
  let frontendAvailable = false;

  try {
    const apiResponse = await request.get(`${API_BASE}/`);
    apiAvailable = apiResponse.ok();
  } catch {
    apiAvailable = false;
  }

  try {
    const frontendResponse = await request.get(`${FRONTEND_BASE}/`);
    frontendAvailable = frontendResponse.ok();
  } catch {
    frontendAvailable = false;
  }

  if (!apiAvailable || !frontendAvailable) {
    console.error('');
    console.error('╔══════════════════════════════════════════════════════════════╗');
    console.error('║  E2E TESTS REQUIRE RUNNING SERVERS                           ║');
    console.error('╠══════════════════════════════════════════════════════════════╣');
    console.error(`║  ${apiAvailable ? '✓' : '✗'} API Server (localhost:3000)     ║`);
    console.error(`║  ${frontendAvailable ? '✓' : '✗'} Frontend (localhost:3001)  ║`);
    console.error('╚══════════════════════════════════════════════════════════════╝');
    apiAvailable = false;
    return;
  }

  apiAvailable = true;

  // Detect backend configuration
  try {
    const featuresResponse = await request.get(`${API_BASE}/iam/features`);
    features = (await featuresResponse.json()) as Features;
  } catch {
    features = {
      emailVerification: true,
      enabled: true,
      jwt: false,
      passkey: true,
      signUpChecks: true,
      twoFactor: true,
    };
  }
});

// =============================================================================
// Test 1: Register -> 2FA -> Passkey (without logout)
// =============================================================================

test.describe.serial('Test 1: Register -> 2FA -> Passkey (no logout)', () => {
  const testUser = generateTestUser('2fa-then-passkey');

  test('Register, enable 2FA, then add Passkey without logout', async ({ page, context }) => {
    test.skip(!apiAvailable, 'Servers not running');

    // Register (adapts to config)
    await registerUser(page, testUser, features!);

    // Enable 2FA
    await enable2FA(page, testUser.password);

    // Add Passkey
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send('WebAuthn.enable');

    const { authenticatorId } = await cdpSession.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    });

    try {
      await gotoAndWaitForHydration(page, '/app/settings/security');
      await page.getByRole('button', { name: 'Passkey hinzufügen' }).click();
      await page.getByPlaceholder('Name für den Passkey').fill('After-2FA-Passkey');
      await page.getByRole('button', { name: 'Hinzufügen' }).click();

      await expect(page.getByText('After-2FA-Passkey')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('2FA ist aktiviert')).toBeVisible();
    } finally {
      await cleanupAuthenticator(cdpSession, authenticatorId);
    }
  });
});

// =============================================================================
// Test 2: Register -> Passkey -> 2FA (without logout)
// =============================================================================

test.describe.serial('Test 2: Register -> Passkey -> 2FA (no logout)', () => {
  const testUser = generateTestUser('passkey-then-2fa');

  test('Register, add Passkey, then enable 2FA without logout', async ({ page, context }) => {
    test.skip(!apiAvailable, 'Servers not running');

    // Register (adapts to config)
    await registerUser(page, testUser, features!);

    // Add Passkey first
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send('WebAuthn.enable');

    const { authenticatorId } = await cdpSession.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    });

    try {
      await gotoAndWaitForHydration(page, '/app/settings/security');
      await page.getByRole('button', { name: 'Passkey hinzufügen' }).click();
      await page.getByPlaceholder('Name für den Passkey').fill('Before-2FA-Passkey');
      await page.getByRole('button', { name: 'Hinzufügen' }).click();

      await expect(page.getByText('Before-2FA-Passkey')).toBeVisible({ timeout: 15000 });

      // Enable 2FA
      await enable2FA(page, testUser.password);

      // Verify both are active
      await gotoAndWaitForHydration(page, '/app/settings/security');
      await expect(page.getByText('2FA ist aktiviert')).toBeVisible();
      await expect(page.getByText('Before-2FA-Passkey')).toBeVisible();
    } finally {
      await cleanupAuthenticator(cdpSession, authenticatorId);
    }
  });
});

// =============================================================================
// Test 3: Error Translations
// =============================================================================

test.describe('Test 3: Error Translations', () => {
  test('3.1 Invalid credentials shows German error message', async ({ page }) => {
    test.skip(!apiAvailable, 'Servers not running');

    await loginWithEmail(page, 'invalid@test.com', 'WrongPassword123!');

    const toast = page.locator('li[role="alert"]');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText('Ungültige Anmeldedaten');
  });

  test('3.2 Error translations are loaded from backend', async ({ page }) => {
    test.skip(!apiAvailable, 'Servers not running');

    await gotoAndWaitForHydration(page, '/auth/login');

    const response = await page.request.get(`${FRONTEND_BASE}/api/i18n/errors/de`);
    expect([200, 304]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('errors');
      expect(data.errors).toHaveProperty('LTNS_0010');
      console.info(`  Error translations loaded: ${Object.keys(data.errors).length} codes`);
    }
  });
});
