import { expect, test } from '@nuxt/test-utils/playwright';
import type { Page } from '@playwright/test';
import {
  waitForHydration,
  gotoAndWaitForHydration,
  waitForURLAndHydration,
  fillInput,
  generateTestUser,
  generateTOTP,
  extractTOTPSecret,
} from '@lenne.tech/nuxt-extensions/testing';

/**
 * Authentication E2E Tests
 *
 * These tests require running servers:
 * - API: npm start (in nest-server-starter)
 * - Frontend: npm run dev (in nuxt-base-template)
 *
 * Run tests with: npm run test:e2e
 *
 * NOTE: These tests are for manual E2E testing only.
 * For CI/CD pipelines, use vitest unit tests instead.
 */

// =============================================================================
// Project-Specific Test Utilities
// =============================================================================

/**
 * Register a new user via UI
 */
async function registerUser(
  page: Page,
  user: { email: string; password: string; name: string },
): Promise<void> {
  await gotoAndWaitForHydration(page, '/auth/register');
  await page.locator('input[name="name"]').waitFor({ state: 'visible', timeout: 10000 });

  // Fill form fields
  await fillInput(page, 'input[name="name"]', user.name);
  await fillInput(page, 'input[name="email"]', user.email);
  await fillInput(page, 'input[name="password"]', user.password);
  await fillInput(page, 'input[name="confirmPassword"]', user.password);

  // Click submit button
  await page.getByRole('button', { name: 'Konto erstellen' }).click();

  // Wait for passkey prompt to appear and dismiss it
  const laterButton = page.getByRole('button', { name: 'Später einrichten' });
  await laterButton.waitFor({ state: 'visible', timeout: 10000 });
  await laterButton.click();

  await waitForURLAndHydration(page, /\/app/, { timeout: 15000 });
}

/**
 * Login with email and password via UI
 */
async function loginWithEmail(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await gotoAndWaitForHydration(page, '/auth/login');
  await page.locator('input[name="email"]').waitFor({ state: 'visible', timeout: 10000 });

  await fillInput(page, 'input[name="email"]', email);
  await fillInput(page, 'input[name="password"]', password);

  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
}

/**
 * Logout via UI
 */
async function logout(page: Page): Promise<void> {
  // Logout button has aria-label="Logout"
  const logoutButton = page.getByLabel('Logout');
  await logoutButton.waitFor({ state: 'visible', timeout: 5000 });
  await logoutButton.click();
  await page.waitForURL(/\/auth\/login/, { timeout: 5000 });
  await waitForHydration(page);
}

/**
 * Enable 2FA and return the TOTP secret
 *
 * NOTE: This function currently has a CORS issue in E2E tests.
 * The authClient sends requests directly to localhost:3000/iam instead of
 * using the Nuxt proxy at /api/iam. This needs to be fixed in nuxt-extensions.
 */
async function enable2FA(page: Page, password: string): Promise<string> {
  await gotoAndWaitForHydration(page, '/app/settings/security');

  // Wait for the 2FA section to be visible
  const enable2FAButton = page.getByRole('button', { name: '2FA aktivieren' });
  await enable2FAButton.waitFor({ state: 'visible', timeout: 10000 });

  // Fill password field
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.click();
  await page.keyboard.type(password, { delay: 5 });

  // Click the button
  await enable2FAButton.click();

  // Wait for QR code (may take a moment for API call)
  const qrImage = page.locator('img[alt="TOTP QR Code"]');
  await expect(qrImage).toBeVisible({ timeout: 15000 });

  const qrUrl = await qrImage.getAttribute('src');
  const secret = qrUrl ? extractTOTPSecret(decodeURIComponent(qrUrl)) : null;
  expect(secret).not.toBeNull();

  // Verify TOTP
  const totpCode = generateTOTP(secret!);
  await fillInput(page, 'input[placeholder="000000"]', totpCode);
  await page.getByRole('button', { name: 'Verifizieren' }).click();

  // Close backup codes dialog (use specific heading selector)
  await expect(page.getByRole('heading', { name: 'Backup-Codes' })).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('Escape');

  return secret!;
}

/**
 * Cleanup Virtual Authenticator
 */
async function cleanupAuthenticator(
  cdpSession: any,
  authenticatorId: string,
): Promise<void> {
  await cdpSession.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
  await cdpSession.send('WebAuthn.disable');
}

// =============================================================================
// API Availability Check
// =============================================================================

let apiAvailable = false;

test.beforeAll(async ({ request }) => {
  // Check API and Frontend availability
  let frontendAvailable = false;

  try {
    const apiResponse = await request.get('http://localhost:3000/');
    apiAvailable = apiResponse.ok();
  } catch {
    apiAvailable = false;
  }

  try {
    const frontendResponse = await request.get('http://localhost:3001/');
    frontendAvailable = frontendResponse.ok();
  } catch {
    frontendAvailable = false;
  }

  if (!apiAvailable || !frontendAvailable) {
    console.error('');
    console.error('╔══════════════════════════════════════════════════════════════╗');
    console.error('║  E2E TESTS REQUIRE RUNNING SERVERS                           ║');
    console.error('╠══════════════════════════════════════════════════════════════╣');
    if (!apiAvailable) {
      console.error('║  ✗ API Server (localhost:3000) - NOT RUNNING                 ║');
    } else {
      console.error('║  ✓ API Server (localhost:3000) - Running                     ║');
    }
    if (!frontendAvailable) {
      console.error('║  ✗ Frontend (localhost:3001) - NOT RUNNING                   ║');
    } else {
      console.error('║  ✓ Frontend (localhost:3001) - Running                       ║');
    }
    console.error('╠══════════════════════════════════════════════════════════════╣');
    console.error('║  NOTE: These tests are for manual E2E testing only.          ║');
    console.error('║  For CI/CD pipelines, use vitest unit tests.                 ║');
    console.error('╚══════════════════════════════════════════════════════════════╝');
    console.error('');
  }

  apiAvailable = apiAvailable && frontendAvailable;
});

// =============================================================================
// Test 1: All Three Auth Methods with Intermediate Logout/Login
// =============================================================================

test.describe.serial('Test 1: All Auth Methods with Logout/Login', () => {
  const testUser = generateTestUser('auth-all');
  let totpSecret: string | null = null;

  test('1.1 Register new user', async ({ page }) => {
    test.skip(!apiAvailable, 'Servers not running');

    await registerUser(page, testUser);
    await expect(page).toHaveURL(/\/app/);
    console.info(`  Registered: ${testUser.email}`);
  });

  test('1.2 Logout after registration', async ({ page }) => {
    test.skip(!apiAvailable, 'Servers not running');

    await loginWithEmail(page, testUser.email, testUser.password);
    await waitForURLAndHydration(page, /\/app/);
    await logout(page);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('1.3 Login with Email & Password', async ({ page }) => {
    test.skip(!apiAvailable, 'Servers not running');

    await loginWithEmail(page, testUser.email, testUser.password);
    await waitForURLAndHydration(page, /\/app/, { timeout: 10000 });
    // Use first() to avoid strict mode violation (email appears multiple times in UI)
    await expect(page.getByText(testUser.email).first()).toBeVisible();
  });

  test('1.4 Enable 2FA', async ({ page }) => {
    test.skip(!apiAvailable, 'Servers not running');

    await loginWithEmail(page, testUser.email, testUser.password);
    await waitForURLAndHydration(page, /\/app/);
    totpSecret = await enable2FA(page, testUser.password);
  });

  test('1.5 Logout and login with 2FA', async ({ page }) => {
    test.skip(!apiAvailable, 'Servers not running');
    test.skip(!totpSecret, 'TOTP secret not available');

    await loginWithEmail(page, testUser.email, testUser.password);
    await waitForURLAndHydration(page, /\/auth\/2fa/, { timeout: 10000 });

    const totpCode = generateTOTP(totpSecret!);
    await page.locator('input').fill(totpCode);
    await page.getByRole('button', { name: /verifizieren|bestätigen/i }).click();

    await waitForURLAndHydration(page, /\/app/, { timeout: 10000 });
  });

  test('1.6 Add Passkey with Virtual Authenticator', async ({ page, context }) => {
    test.skip(!apiAvailable, 'Servers not running');
    test.skip(!totpSecret, 'TOTP secret not available');

    // Login with 2FA
    await loginWithEmail(page, testUser.email, testUser.password);
    await waitForURLAndHydration(page, /\/auth\/2fa/, { timeout: 10000 });

    const totpCode = generateTOTP(totpSecret!);
    await page.locator('input').fill(totpCode);
    await page.getByRole('button', { name: /verifizieren|bestätigen/i }).click();
    await waitForURLAndHydration(page, /\/app/, { timeout: 10000 });

    // Setup Virtual Authenticator
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send('WebAuthn.enable');

    const { authenticatorId } = await cdpSession.send(
      'WebAuthn.addVirtualAuthenticator',
      {
        options: {
          protocol: 'ctap2',
          transport: 'internal',
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
        },
      },
    );

    try {
      await gotoAndWaitForHydration(page, '/app/settings/security');
      await page.getByRole('button', { name: 'Passkey hinzufügen' }).click();
      await page.getByPlaceholder('Name für den Passkey').fill('Test-Passkey');
      await page.getByRole('button', { name: 'Hinzufügen' }).click();

      await expect(page.getByText('Test-Passkey')).toBeVisible({ timeout: 15000 });
    } finally {
      await cleanupAuthenticator(cdpSession, authenticatorId);
    }
  });

  test('1.7 Login with Passkey', async ({ page, context }) => {
    test.skip(!apiAvailable, 'Servers not running');
    test.skip(!totpSecret, 'TOTP secret not available');

    // Setup Virtual Authenticator
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send('WebAuthn.enable');

    const { authenticatorId } = await cdpSession.send(
      'WebAuthn.addVirtualAuthenticator',
      {
        options: {
          protocol: 'ctap2',
          transport: 'internal',
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
        },
      },
    );

    try {
      // First add passkey while logged in via 2FA
      await loginWithEmail(page, testUser.email, testUser.password);
      await waitForURLAndHydration(page, /\/auth\/2fa/, { timeout: 10000 });

      const totpCode = generateTOTP(totpSecret!);
      await page.locator('input').fill(totpCode);
      await page.getByRole('button', { name: /verifizieren|bestätigen/i }).click();
      await waitForURLAndHydration(page, /\/app/, { timeout: 10000 });

      // Add passkey
      await gotoAndWaitForHydration(page, '/app/settings/security');
      await page.getByRole('button', { name: 'Passkey hinzufügen' }).click();
      await page.getByPlaceholder('Name für den Passkey').fill('Login-Passkey');
      await page.getByRole('button', { name: 'Hinzufügen' }).click();
      await expect(page.getByText('Login-Passkey')).toBeVisible({ timeout: 15000 });

      // Logout
      await logout(page);

      // Login with passkey
      await gotoAndWaitForHydration(page, '/auth/login');
      await page.getByRole('button', { name: 'Mit Passkey anmelden' }).click();
      await waitForURLAndHydration(page, /\/app/, { timeout: 15000 });
    } finally {
      await cleanupAuthenticator(cdpSession, authenticatorId);
    }
  });
});

// =============================================================================
// Test 2: Register -> 2FA -> Passkey (without logout)
// =============================================================================

test.describe.serial('Test 2: Register -> 2FA -> Passkey (no logout)', () => {
  const testUser = generateTestUser('2fa-then-passkey');

  test('Register, enable 2FA, then add Passkey without logout', async ({ page, context }) => {
    test.skip(!apiAvailable, 'Servers not running');

    // Register
    await registerUser(page, testUser);

    // Enable 2FA
    await enable2FA(page, testUser.password);

    // Add Passkey
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send('WebAuthn.enable');

    const { authenticatorId } = await cdpSession.send(
      'WebAuthn.addVirtualAuthenticator',
      {
        options: {
          protocol: 'ctap2',
          transport: 'internal',
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
        },
      },
    );

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
// Test 3: Register -> Passkey -> 2FA (without logout)
// =============================================================================

test.describe.serial('Test 3: Register -> Passkey -> 2FA (no logout)', () => {
  const testUser = generateTestUser('passkey-then-2fa');

  test('Register, add Passkey, then enable 2FA without logout', async ({ page, context }) => {
    test.skip(!apiAvailable, 'Servers not running');

    // Register
    await registerUser(page, testUser);

    // Add Passkey first
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send('WebAuthn.enable');

    const { authenticatorId } = await cdpSession.send(
      'WebAuthn.addVirtualAuthenticator',
      {
        options: {
          protocol: 'ctap2',
          transport: 'internal',
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
        },
      },
    );

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
// Test 4: Error Translations
// =============================================================================

test.describe('Test 4: Error Translations', () => {
  test('4.1 Invalid credentials shows German error message', async ({ page }) => {
    test.skip(!apiAvailable, 'Servers not running');

    await loginWithEmail(page, 'invalid@test.com', 'WrongPassword123!');

    // Wait for toast notification (use more specific selector)
    const toast = page.locator('li[role="alert"]');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText('Ungültige Anmeldedaten');
  });

  test('4.2 Error translations are loaded from backend', async ({ page }) => {
    test.skip(!apiAvailable, 'Servers not running');

    await gotoAndWaitForHydration(page, '/auth/login');

    // Check translations endpoint
    const response = await page.request.get('http://localhost:3001/api/i18n/errors/de');
    expect([200, 304]).toContain(response.status());

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('errors');
      expect(data.errors).toHaveProperty('LTNS_0010');
      console.info(`  Error translations loaded: ${Object.keys(data.errors).length} codes`);
    }
  });
});
