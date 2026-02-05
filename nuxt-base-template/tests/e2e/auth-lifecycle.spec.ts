import { expect, test } from '@nuxt/test-utils/playwright';
import type { BrowserContext, Page } from '@playwright/test';
import * as fs from 'node:fs';
import { MongoClient } from 'mongodb';
import {
  extractTOTPSecret,
  fillInput,
  generateTestUser,
  generateTOTP,
  gotoAndWaitForHydration,
  waitForHydration,
  waitForURLAndHydration,
} from '@lenne.tech/nuxt-extensions/testing';

/**
 * Comprehensive Better-Auth E2E Tests — Auth Lifecycle
 *
 * Tests the complete authentication lifecycle:
 * 0. Full reset (database + browser)
 * 1. Registration (with terms checkbox if signUpChecks enabled)
 * 2. Email verification (if emailVerification enabled)
 * 3. Passkey activation + login via Passkey
 * 4. 2FA activation
 * 5. Login via 2FA
 * 6. Passkey deletion
 * 7. 2FA deactivation
 * 8. Login without 2FA
 *
 * Automatically detects the current backend configuration via GET /iam/features
 * and adapts the test flow accordingly (skips non-applicable steps).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * CONFIGURATION SCENARIOS (for AI agents / CI)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The tests should be run against ALL 4 backend configurations to ensure
 * full coverage. The configuration is set in the betterAuth section of:
 *
 *   Fullstack (lt fullstack init): projects/api/src/config.env.ts
 *   Standalone (nest-server-starter): src/config.env.ts
 *
 * After changing the config, restart the backend server and re-run the tests.
 *
 * Scenario 1 — Zero Config (default, everything enabled):
 *   No changes needed. Default nest-server-starter config.
 *   Expected features: cookies=true, emailVerification=true, signUpChecks=true,
 *                      twoFactor=true, passkey=true
 *
 * Scenario 2 — Cookies, no verification/checks:
 *   betterAuth: {
 *     cookies: true,
 *     emailVerification: false,
 *     signUpChecks: false,
 *   }
 *   Expected features: jwt=false, emailVerification=false, signUpChecks=false,
 *                      twoFactor=true, passkey=true
 *   Effect: No terms checkbox, no email verification step, direct login after register.
 *
 * Scenario 3 — JWT mode, everything else enabled:
 *   betterAuth: {
 *     cookies: false,
 *   }
 *   Expected features: jwt=true, emailVerification=true, signUpChecks=true,
 *                      twoFactor=true, passkey=true
 *   Effect: Auth via JWT instead of cookies, all features active.
 *
 * Scenario 4 — JWT mode, no verification/checks:
 *   betterAuth: {
 *     cookies: false,
 *     emailVerification: false,
 *     signUpChecks: false,
 *   }
 *   Expected features: jwt=true, emailVerification=false, signUpChecks=false,
 *                      twoFactor=true, passkey=true
 *   Effect: JWT mode, no terms checkbox, no email verification.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * BACKEND OPTIONS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Either of these can serve as the API backend on port 3000:
 *
 * Option A — nest-server-starter (standalone template):
 *   Repository: nest-server-starter
 *   Config:     src/config.env.ts → betterAuth section
 *   Start:      cd <nest-server-starter> && npm run start > /tmp/nest-server.log 2>&1 &
 *
 * Option B — nest-server (direct, e.g. during nest-server development):
 *   Repository: nest-server
 *   Config:     src/config.env.ts → betterAuth section
 *   Start:      cd <nest-server> && npm run start > /tmp/nest-server.log 2>&1 &
 *
 * In a fullstack project (lt fullstack init), the API is at:
 *   Config:     projects/api/src/config.env.ts → betterAuth section
 *   Start:      cd projects/api && npm run start > /tmp/nest-server.log 2>&1 &
 *
 * The backend MUST be started with stdout redirected to a log file
 * (default: /tmp/nest-server.log, override via NEST_SERVER_LOG env var)
 * because email verification tokens are extracted from the server logs.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * HOW TO RUN ALL SCENARIOS (automated, for AI agents like Claude Code)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * For each scenario:
 *   1. Edit config.env.ts → betterAuth section (see paths above)
 *   2. Restart backend:
 *        pkill -f "nest-server" 2>/dev/null
 *        cd <backend-path> && npm run start > /tmp/nest-server.log 2>&1 &
 *   3. Wait for backend ready: curl -s http://localhost:3000/ > /dev/null
 *   4. Run tests:
 *        npx playwright test tests/e2e/auth-lifecycle.spec.ts
 *   5. Check config banner in output to verify which scenario was detected
 *   6. Restore config.env.ts to original state after all scenarios
 *
 * The test output includes a configuration banner showing the detected scenario:
 *   ╔═════════════════════════════╗
 *   ║  Szenario X: <description>  ║
 *   ╚═════════════════════════════╝
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Requirements:
 * - API: nest-server-starter OR nest-server running on port 3000
 *        (stdout redirected to /tmp/nest-server.log or NEST_SERVER_LOG)
 * - Frontend: nuxt-base-starter running on port 3001
 * - MongoDB: running on localhost:27017
 *
 * Run: npx playwright test tests/e2e/auth-lifecycle.spec.ts
 */

// =============================================================================
// Types
// =============================================================================

interface Features {
  emailVerification: boolean;
  enabled: boolean;
  jwt: boolean;
  passkey: boolean;
  resendCooldownSeconds: number;
  signUpChecks: boolean;
  socialProviders: string[];
  twoFactor: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const MONGO_URI = 'mongodb://127.0.0.1/nest-server-local';
const API_BASE = 'http://localhost:3000';
const FRONTEND_BASE = 'http://localhost:3001';

// Better-Auth collection names (default without prefix)
const COLLECTIONS = ['session', 'account', 'verification', 'passkey', 'twoFactor', 'backupCode'];

// =============================================================================
// MongoDB Helpers
// =============================================================================

async function resetTestData(email: string): Promise<void> {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();

    // Try to find user in the 'users' collection (Better-Auth modelName)
    const user = await db.collection('users').findOne({ email });
    if (user) {
      const userId = user._id.toString();
      for (const coll of COLLECTIONS) {
        try {
          await db.collection(coll).deleteMany({ userId });
        } catch {
          // Collection may not exist yet
        }
      }
      try {
        await db.collection('webauthn_challenge_mappings').deleteMany({ userId });
      } catch {
        // Collection may not exist
      }
      // Also clean verification by identifier (email)
      try {
        await db.collection('verification').deleteMany({ identifier: email });
      } catch {
        // Collection may not exist
      }
      await db.collection('users').deleteOne({ _id: user._id });
    }
  } finally {
    await client.close();
  }
}

/**
 * Extract email verification token from backend server logs.
 *
 * The nest-server logs verification URLs in this format:
 * [EMAIL VERIFICATION] User: <email>, URL: <baseUrl>/auth/verify-email?token=<jwt>
 *
 * The token is a JWT (not stored in MongoDB), so we must read it from the logs.
 * Set NEST_SERVER_LOG env var to point to the server log file.
 * Default: /tmp/nest-server.log
 */
async function getVerificationToken(email: string, maxRetries = 10): Promise<string | null> {
  const logPath = process.env.NEST_SERVER_LOG || '/tmp/nest-server.log';

  for (let i = 0; i < maxRetries; i++) {
    try {
      const log = fs.readFileSync(logPath, 'utf-8');
      // Find the verification line for this email
      const regex = new RegExp(`\\[EMAIL VERIFICATION\\] User: ${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, URL: .+?token=([^&\\s]+)`);
      const match = log.match(regex);
      if (match?.[1]) {
        return match[1];
      }
    } catch {
      // Log file may not exist yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
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
}

async function loginWith2FA(page: Page, email: string, password: string, totpSecret: string): Promise<void> {
  await loginWithEmail(page, email, password);
  await waitForURLAndHydration(page, /\/auth\/2fa/, { timeout: 10000 });

  const totpCode = generateTOTP(totpSecret);
  await page.locator('input').fill(totpCode);
  await page.getByRole('button', { name: /verifizieren|bestätigen/i }).click();
  await waitForURLAndHydration(page, /\/app/, { timeout: 15000 });
}

async function logout(page: Page): Promise<void> {
  const logoutButton = page.getByLabel('Logout');
  await logoutButton.waitFor({ state: 'visible', timeout: 5000 });
  await logoutButton.click();
  await page.waitForURL(/\/auth\/login/, { timeout: 5000 });
  await waitForHydration(page);
}

async function setupVirtualAuthenticator(context: BrowserContext, page: Page) {
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
  return { cdpSession, authenticatorId };
}

async function cleanupAuthenticator(cdpSession: any, authenticatorId: string): Promise<void> {
  try {
    await cdpSession.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
    await cdpSession.send('WebAuthn.disable');
  } catch {
    // Ignore cleanup errors
  }
}

function getConfigScenarioName(features: Features): string {
  const cookies = !features.jwt;
  if (cookies && features.emailVerification && features.signUpChecks) return 'Szenario 1: Zero Config (alles aktiviert, Cookies)';
  if (cookies && !features.emailVerification && !features.signUpChecks) return 'Szenario 2: Cookies, ohne EmailVerification/SignUpChecks';
  if (!cookies && features.emailVerification && features.signUpChecks) return 'Szenario 3: JWT, alles aktiviert';
  if (!cookies && !features.emailVerification && !features.signUpChecks) return 'Szenario 4: JWT, ohne EmailVerification/SignUpChecks';
  return `Custom Config (jwt=${features.jwt}, emailVerification=${features.emailVerification}, signUpChecks=${features.signUpChecks})`;
}

// =============================================================================
// Tests
// =============================================================================

let apiAvailable = false;
let features: Features | null = null;

test.beforeAll(async ({ request }) => {
  // Check API and Frontend availability
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
    console.error('╔══════════════════════════════════════════════════════════════════╗');
    console.error('║  COMPREHENSIVE E2E TESTS REQUIRE RUNNING SERVERS                ║');
    console.error('╠══════════════════════════════════════════════════════════════════╣');
    console.error(`║  ${apiAvailable ? '✓' : '✗'} API Server (localhost:3000) - ${apiAvailable ? 'Running' : 'NOT RUNNING'}                   ║`);
    console.error(`║  ${frontendAvailable ? '✓' : '✗'} Frontend (localhost:3001) - ${frontendAvailable ? 'Running' : 'NOT RUNNING'}                    ║`);
    console.error('╠══════════════════════════════════════════════════════════════════╣');
    console.error('║  Start servers:                                                  ║');
    console.error('║  API: cd nest-server-starter && npm run start:local              ║');
    console.error('║  APP: cd nuxt-base-template && npm run dev                       ║');
    console.error('╚══════════════════════════════════════════════════════════════════╝');
    apiAvailable = false;
    return;
  }

  apiAvailable = true;

  // Fetch features to detect configuration
  try {
    const featuresResponse = await request.get(`${API_BASE}/iam/features`);
    features = (await featuresResponse.json()) as Features;
  } catch {
    console.error('Could not fetch /iam/features - assuming zero config (defaults)');
    features = {
      emailVerification: true,
      enabled: true,
      jwt: false,
      passkey: true,
      resendCooldownSeconds: 60,
      signUpChecks: true,
      socialProviders: [],
      twoFactor: true,
    };
  }

  // Print configuration banner
  console.info('');
  console.info('╔══════════════════════════════════════════════════════════════════╗');
  console.info('║  BETTER-AUTH E2E TEST CONFIGURATION                             ║');
  console.info('╠══════════════════════════════════════════════════════════════════╣');
  console.info(`║  ${getConfigScenarioName(features).padEnd(62)}║`);
  console.info('╠══════════════════════════════════════════════════════════════════╣');
  console.info(`║  JWT Mode:            ${String(features.jwt).padEnd(40)}║`);
  console.info(`║  Email Verification:  ${String(features.emailVerification).padEnd(40)}║`);
  console.info(`║  Sign-Up Checks:      ${String(features.signUpChecks).padEnd(40)}║`);
  console.info(`║  Two-Factor:          ${String(features.twoFactor).padEnd(40)}║`);
  console.info(`║  Passkey:             ${String(features.passkey).padEnd(40)}║`);
  console.info('╚══════════════════════════════════════════════════════════════════╝');
  console.info('');
});

// =============================================================================
// Comprehensive Better-Auth Flow
// =============================================================================

test.describe.serial('Comprehensive Better-Auth E2E Flow', () => {
  const testUser = generateTestUser('comprehensive');
  let totpSecret: string | null = null;

  // =========================================================================
  // Step 0: Full Reset
  // =========================================================================

  test('Step 0: Full Reset (Database + Browser)', async ({ page }) => {
    test.skip(!apiAvailable, 'Servers not running');

    // Reset database for this test user
    await resetTestData(testUser.email);

    // Clear browser state
    await page.context().clearCookies();

    console.info(`  Test user: ${testUser.email}`);
    console.info(`  Database reset complete`);
  });

  // =========================================================================
  // Step 1: Registration
  // =========================================================================

  test('Step 1: Register new user', async ({ page }) => {
    test.skip(!apiAvailable, 'Servers not running');

    await gotoAndWaitForHydration(page, '/auth/register');
    await page.locator('input[name="name"]').waitFor({ state: 'visible', timeout: 10000 });

    // Fill registration form
    await fillInput(page, 'input[name="name"]', testUser.name);
    await fillInput(page, 'input[name="email"]', testUser.email);
    await fillInput(page, 'input[name="password"]', testUser.password);
    await fillInput(page, 'input[name="confirmPassword"]', testUser.password);

    // Accept terms if signUpChecks is enabled
    if (features?.signUpChecks) {
      // NuxtUI UCheckbox renders both a button[role=checkbox] and a hidden input
      // Use the aria-label to target the visible checkbox button specifically
      const termsCheckbox = page.getByRole('checkbox', { name: /akzeptiere die AGB/i });
      await termsCheckbox.waitFor({ state: 'visible', timeout: 5000 });
      await termsCheckbox.check();
      console.info('  Terms checkbox checked (signUpChecks enabled)');
    }

    // Submit form
    await page.getByRole('button', { name: 'Konto erstellen' }).click();

    if (features?.emailVerification) {
      // Should redirect to verify-email page
      await waitForURLAndHydration(page, /\/auth\/verify-email/, { timeout: 15000 });
      await expect(page.getByText('E-Mail bestätigen')).toBeVisible({ timeout: 5000 });
      console.info('  Redirected to email verification (emailVerification enabled)');
    } else {
      // Should show passkey prompt, skip it
      const laterButton = page.getByRole('button', { name: 'Später einrichten' });
      await laterButton.waitFor({ state: 'visible', timeout: 10000 });
      await laterButton.click();

      await waitForURLAndHydration(page, /\/app/, { timeout: 15000 });
      console.info('  Registered and logged in (no email verification)');
    }

    console.info(`  Registered: ${testUser.email}`);
  });

  // =========================================================================
  // Step 2: Email Verification (conditional)
  // =========================================================================

  test('Step 2: Verify email address', async ({ page }) => {
    test.skip(!apiAvailable, 'Servers not running');
    test.skip(!features?.emailVerification, 'Email verification disabled in current config');

    // Fetch verification token from backend server logs
    // The nest-server logs: [EMAIL VERIFICATION] User: <email>, URL: ...?token=<jwt>
    const token = await getVerificationToken(testUser.email);
    expect(token, 'Verification token not found in server logs. Ensure backend logs to /tmp/nest-server.log or set NEST_SERVER_LOG').not.toBeNull();

    // Navigate to verify-email with token
    await gotoAndWaitForHydration(page, `/auth/verify-email?token=${token}`);

    // Wait for verification success (use heading to avoid ambiguity with toast notification)
    await expect(page.getByRole('heading', { name: 'E-Mail bestätigt' })).toBeVisible({ timeout: 15000 });
    console.info('  Email verified successfully');

    // Click "Jetzt anmelden" to go to login
    await page.getByRole('link', { name: 'Jetzt anmelden' }).click();
    await waitForURLAndHydration(page, /\/auth\/login/, { timeout: 10000 });
    console.info('  Redirected to login page');
  });

  // =========================================================================
  // Step 3: Passkey Activation + Login via Passkey
  // =========================================================================

  test('Step 3: Activate Passkey and login via Passkey', async ({ page, context }) => {
    test.skip(!apiAvailable, 'Servers not running');

    // Login with email/password first
    await loginWithEmail(page, testUser.email, testUser.password);

    // Handle passkey prompt after login (if coming from registration without email verification)
    // or direct to /app
    try {
      await waitForURLAndHydration(page, /\/app/, { timeout: 15000 });
    } catch {
      // May still be on passkey prompt
      const laterButton = page.getByRole('button', { name: 'Später einrichten' });
      if (await laterButton.isVisible()) {
        await laterButton.click();
        await waitForURLAndHydration(page, /\/app/, { timeout: 10000 });
      }
    }

    // Setup virtual authenticator
    const { cdpSession, authenticatorId } = await setupVirtualAuthenticator(context, page);

    try {
      // Navigate to security settings
      await gotoAndWaitForHydration(page, '/app/settings/security');

      // Add passkey
      await page.getByRole('button', { name: 'Passkey hinzufügen' }).click();
      await page.getByPlaceholder('Name für den Passkey').fill('E2E-Fingerprint');
      await page.getByRole('button', { name: 'Hinzufügen' }).click();

      // Verify passkey appears in list
      await expect(page.getByText('E2E-Fingerprint')).toBeVisible({ timeout: 15000 });
      console.info('  Passkey "E2E-Fingerprint" registered');

      // Logout
      await logout(page);
      console.info('  Logged out');

      // Login with passkey
      await gotoAndWaitForHydration(page, '/auth/login');
      await page.getByRole('button', { name: 'Mit Passkey anmelden' }).click();
      await waitForURLAndHydration(page, /\/app/, { timeout: 15000 });
      console.info('  Logged in via Passkey');

      // Logout for next test
      await logout(page);
    } finally {
      await cleanupAuthenticator(cdpSession, authenticatorId);
    }
  });

  // =========================================================================
  // Step 4: 2FA Activation
  // =========================================================================

  test('Step 4: Activate 2FA', async ({ page }) => {
    test.skip(!apiAvailable, 'Servers not running');

    // Login with email/password
    await loginWithEmail(page, testUser.email, testUser.password);
    await waitForURLAndHydration(page, /\/app/, { timeout: 15000 });

    // Navigate to security settings
    await gotoAndWaitForHydration(page, '/app/settings/security');

    // Wait for 2FA section
    const enableButton = page.getByRole('button', { name: '2FA aktivieren' });
    await enableButton.waitFor({ state: 'visible', timeout: 10000 });

    // Fill password
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.click();
    await page.keyboard.type(testUser.password, { delay: 5 });

    // Intercept the 2FA enable response to extract TOTP URI
    const responsePromise = page.waitForResponse((resp) => resp.url().includes('/two-factor/enable') && resp.status() === 200);

    // Click enable button
    await enableButton.click();

    // Extract TOTP secret from API response
    const response = await responsePromise;
    const responseBody = await response.json();
    const totpUri = responseBody.totpURI || responseBody.data?.totpURI;
    expect(totpUri, '2FA enable response should contain totpURI').toBeTruthy();

    const secret = extractTOTPSecret(totpUri);
    expect(secret, 'TOTP secret should be extractable from URI').not.toBeNull();
    totpSecret = secret;

    // Wait for QR code SVG to render
    await page.locator('.bg-white svg').waitFor({ state: 'visible', timeout: 10000 });

    // Generate and enter TOTP code
    const totpCode = generateTOTP(secret!);
    await fillInput(page, 'input[placeholder="000000"]', totpCode);
    await page.getByRole('button', { name: 'Verifizieren' }).click();

    // Wait for backup codes modal and dismiss
    await expect(page.getByRole('heading', { name: 'Backup-Codes' })).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');

    // Verify 2FA is now active
    await expect(page.getByText('2FA ist aktiviert')).toBeVisible({ timeout: 5000 });
    console.info('  2FA activated, TOTP secret stored');

    // Logout
    await logout(page);
  });

  // =========================================================================
  // Step 5: Login with 2FA
  // =========================================================================

  test('Step 5: Login with 2FA', async ({ page }) => {
    test.skip(!apiAvailable, 'Servers not running');
    test.skip(!totpSecret, 'TOTP secret not available (2FA activation failed)');

    // Login with email/password → should redirect to 2FA
    await loginWithEmail(page, testUser.email, testUser.password);
    await waitForURLAndHydration(page, /\/auth\/2fa/, { timeout: 10000 });

    // Enter TOTP code
    const totpCode = generateTOTP(totpSecret!);
    await page.locator('input').fill(totpCode);
    await page.getByRole('button', { name: /verifizieren|bestätigen/i }).click();

    // Should redirect to app
    await waitForURLAndHydration(page, /\/app/, { timeout: 15000 });
    await expect(page.getByText(testUser.email).first()).toBeVisible({ timeout: 5000 });
    console.info('  Logged in with 2FA');

    // Logout
    await logout(page);
  });

  // =========================================================================
  // Step 6: Delete Passkey
  // =========================================================================

  test('Step 6: Delete Passkey', async ({ page }) => {
    test.skip(!apiAvailable, 'Servers not running');
    test.skip(!totpSecret, 'TOTP secret not available (2FA required for login)');

    // Login with 2FA
    await loginWith2FA(page, testUser.email, testUser.password, totpSecret!);

    // Navigate to security settings
    await gotoAndWaitForHydration(page, '/app/settings/security');

    // Find and delete the passkey
    await expect(page.getByText('E2E-Fingerprint')).toBeVisible({ timeout: 10000 });

    // Find the passkey row container that has both the name and delete button
    // Structure: div.py-3 > [name div] + UButton(Löschen)
    const passkeyRow = page.locator('div.py-3').filter({ hasText: 'E2E-Fingerprint' });
    await passkeyRow.getByRole('button', { name: 'Löschen' }).click();

    // Verify passkey is removed
    await expect(page.getByText('E2E-Fingerprint')).not.toBeVisible({ timeout: 10000 });
    console.info('  Passkey "E2E-Fingerprint" deleted');

    // Logout
    await logout(page);
  });

  // =========================================================================
  // Step 7: Deactivate 2FA
  // =========================================================================

  test('Step 7: Deactivate 2FA', async ({ page }) => {
    test.skip(!apiAvailable, 'Servers not running');
    test.skip(!totpSecret, 'TOTP secret not available (2FA required for login)');

    // Login with 2FA
    await loginWith2FA(page, testUser.email, testUser.password, totpSecret!);

    // Navigate to security settings
    await gotoAndWaitForHydration(page, '/app/settings/security');

    // Verify 2FA is currently active
    await expect(page.getByText('2FA ist aktiviert')).toBeVisible({ timeout: 5000 });

    // Click deactivate button
    await page.getByRole('button', { name: '2FA deaktivieren' }).first().click();

    // Fill password in the deactivation form
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.waitFor({ state: 'visible', timeout: 5000 });
    await passwordInput.click();
    await page.keyboard.type(testUser.password, { delay: 5 });

    // Click the red deactivate confirmation button
    const confirmButton = page.getByRole('button', { name: '2FA deaktivieren' }).last();
    await confirmButton.click();

    // Verify 2FA is now deactivated
    await expect(page.getByText('2FA ist deaktiviert')).toBeVisible({ timeout: 10000 });
    console.info('  2FA deactivated');

    // Clear TOTP secret since 2FA is disabled
    totpSecret = null;

    // Logout
    await logout(page);
  });

  // =========================================================================
  // Step 8: Login without 2FA
  // =========================================================================

  test('Step 8: Login without 2FA', async ({ page }) => {
    test.skip(!apiAvailable, 'Servers not running');

    // Login with email/password
    await loginWithEmail(page, testUser.email, testUser.password);

    // Should redirect DIRECTLY to /app (no 2FA redirect)
    await waitForURLAndHydration(page, /\/app/, { timeout: 15000 });

    // Verify we are NOT on the 2FA page
    expect(page.url()).not.toContain('/auth/2fa');

    // Verify user is logged in
    await expect(page.getByText(testUser.email).first()).toBeVisible({ timeout: 5000 });
    console.info('  Logged in without 2FA - direct to /app');
  });

  // =========================================================================
  // Cleanup
  // =========================================================================

  test.afterAll(async () => {
    // Clean up test data from database
    try {
      await resetTestData(testUser.email);
      console.info(`  Cleanup: test user ${testUser.email} removed from database`);
    } catch (error) {
      console.error(`  Cleanup failed: ${error}`);
    }
  });
});
