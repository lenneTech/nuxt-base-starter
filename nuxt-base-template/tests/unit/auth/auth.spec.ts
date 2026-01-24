/**
 * Authentication Unit Tests
 *
 * These tests cover the same functionality as the E2E Playwright tests,
 * but use mocks instead of real servers. They can run in CI/CD pipelines.
 *
 * Test Coverage:
 * - User registration
 * - Login with email/password
 * - Logout
 * - 2FA enable/disable/verify
 * - Passkey management
 * - Error translations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createMockAuthClient,
  mockUser,
  mockTotpData,
  mockPasskey,
  resetMockAuthClient,
} from '../mocks/auth-client.mock';
import { resetCookies } from '../setup';

// ============================================================================
// Test Suite: Registration
// ============================================================================

describe('Registration', () => {
  let authClient: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    authClient = createMockAuthClient();
    resetCookies();
  });

  it('should register a new user with valid credentials', async () => {
    const newUser = {
      email: 'new@test.com',
      password: 'SecurePass123!',
      name: 'New User',
    };

    const result = await authClient.signUp.email(newUser);

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.data?.user.email).toBe(newUser.email);
    expect(result.data?.user.name).toBe(newUser.name);
    expect(authClient.signUp.email).toHaveBeenCalledWith(newUser);
  });

  it('should have a session after registration', async () => {
    await authClient.signUp.email({
      email: 'new@test.com',
      password: 'SecurePass123!',
      name: 'New User',
    });

    const session = authClient._getSession();
    expect(session).not.toBeNull();
    expect(session?.user.email).toBe('new@test.com');
  });
});

// ============================================================================
// Test Suite: Login
// ============================================================================

describe('Login', () => {
  let authClient: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    authClient = createMockAuthClient();
    resetCookies();
  });

  it('should login with valid email and password', async () => {
    const credentials = {
      email: 'test@example.com',
      password: 'SecurePass123!',
    };

    const result = await authClient.signIn.email(credentials);

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.data?.user.email).toBe(credentials.email);
  });

  it('should fail login with invalid credentials', async () => {
    const credentials = {
      email: 'invalid@test.com',
      password: 'WrongPassword!',
    };

    const result = await authClient.signIn.email(credentials);

    expect(result.error).not.toBeNull();
    expect(result.error?.message).toBe('Ungültige Anmeldedaten');
    expect(result.data).toBeNull();
  });

  it('should login with passkey', async () => {
    const result = await authClient.signIn.passkey();

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.data?.user).toBeDefined();
  });
});

// ============================================================================
// Test Suite: Logout
// ============================================================================

describe('Logout', () => {
  let authClient: ReturnType<typeof createMockAuthClient>;

  beforeEach(async () => {
    authClient = createMockAuthClient();
    resetCookies();
    // Login first
    await authClient.signIn.email({
      email: 'test@example.com',
      password: 'SecurePass123!',
    });
  });

  it('should have session before logout', () => {
    const session = authClient._getSession();
    expect(session).not.toBeNull();
  });

  it('should clear session after logout', async () => {
    await authClient.signOut();

    const session = authClient._getSession();
    expect(session).toBeNull();
  });

  it('should call signOut method', async () => {
    await authClient.signOut();
    expect(authClient.signOut).toHaveBeenCalled();
  });
});

// ============================================================================
// Test Suite: Two-Factor Authentication (2FA)
// ============================================================================

describe('Two-Factor Authentication', () => {
  let authClient: ReturnType<typeof createMockAuthClient>;

  beforeEach(async () => {
    authClient = createMockAuthClient();
    resetCookies();
    // Login first
    await authClient.signIn.email({
      email: 'test@example.com',
      password: 'SecurePass123!',
    });
  });

  describe('Enable 2FA', () => {
    it('should return TOTP URI and backup codes when enabling 2FA', async () => {
      const result = await authClient.twoFactor.enable({ password: 'SecurePass123!' });

      expect(result.error).toBeNull();
      expect(result.data).not.toBeNull();
      expect(result.data?.totpURI).toContain('otpauth://totp/');
      expect(result.data?.backupCodes).toHaveLength(5);
    });

    it('should extract secret from TOTP URI', async () => {
      const result = await authClient.twoFactor.enable({ password: 'SecurePass123!' });

      const totpUri = result.data?.totpURI;
      const secretMatch = totpUri?.match(/secret=([A-Z2-7]+)/i);
      expect(secretMatch).not.toBeNull();
      expect(secretMatch?.[1]).toBe('JBSWY3DPEHPK3PXP');
    });
  });

  describe('Verify TOTP', () => {
    it('should verify valid TOTP code', async () => {
      const result = await authClient.twoFactor.verifyTotp({ code: '123456' });

      expect(result.error).toBeNull();
      expect(result.data).not.toBeNull();
    });

    it('should reject invalid TOTP code', async () => {
      const result = await authClient.twoFactor.verifyTotp({ code: '000000' });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toBe('Ungültiger Code');
    });

    it('should set twoFactorEnabled after successful verification', async () => {
      await authClient.twoFactor.verifyTotp({ code: '123456' });

      const session = authClient._getSession();
      expect(session?.user.twoFactorEnabled).toBe(true);
    });
  });

  describe('Disable 2FA', () => {
    it('should disable 2FA with password', async () => {
      // First enable 2FA
      await authClient.twoFactor.enable({ password: 'SecurePass123!' });
      await authClient.twoFactor.verifyTotp({ code: '123456' });

      // Then disable
      const result = await authClient.twoFactor.disable({ password: 'SecurePass123!' });

      expect(result.error).toBeNull();
      const session = authClient._getSession();
      expect(session?.user.twoFactorEnabled).toBe(false);
    });
  });

  describe('Backup Codes', () => {
    it('should generate backup codes', async () => {
      const result = await authClient.twoFactor.generateBackupCodes({ password: 'SecurePass123!' });

      expect(result.error).toBeNull();
      expect(result.data?.backupCodes).toHaveLength(5);
    });

    it('should verify backup code', async () => {
      const result = await authClient.twoFactor.verifyBackupCode({ code: '12345678' });

      expect(result.error).toBeNull();
      expect(result.data).not.toBeNull();
    });
  });
});

// ============================================================================
// Test Suite: Passkey Management
// ============================================================================

describe('Passkey Management', () => {
  let authClient: ReturnType<typeof createMockAuthClient>;

  beforeEach(async () => {
    authClient = createMockAuthClient();
    resetCookies();
    // Login first
    await authClient.signIn.email({
      email: 'test@example.com',
      password: 'SecurePass123!',
    });
  });

  it('should add a new passkey', async () => {
    const passkeyName = 'My Laptop';
    const result = await authClient.passkey.addPasskey({ name: passkeyName });

    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.data?.name).toBe(passkeyName);
  });

  it('should list user passkeys', async () => {
    const result = await authClient.passkey.listUserPasskeys();

    expect(result.error).toBeNull();
    expect(result.data).toBeInstanceOf(Array);
    expect(result.data?.length).toBeGreaterThan(0);
  });

  it('should delete a passkey', async () => {
    const result = await authClient.passkey.deletePasskey({ id: 'passkey-123' });

    expect(result.error).toBeNull();
    expect(result.data).toBe(true);
  });
});

// ============================================================================
// Test Suite: Error Translations
// ============================================================================

describe('Error Translations', () => {
  let authClient: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    authClient = createMockAuthClient();
    resetCookies();
  });

  it('should return German error message for invalid credentials', async () => {
    const result = await authClient.signIn.email({
      email: 'invalid@test.com',
      password: 'WrongPassword!',
    });

    expect(result.error?.message).toBe('Ungültige Anmeldedaten');
  });

  it('should return error code for backend errors', async () => {
    const result = await authClient.signIn.email({
      email: 'invalid@test.com',
      password: 'WrongPassword!',
    });

    expect(result.error?.code).toBe('LTNS_0010');
  });
});

// ============================================================================
// Test Suite: Complete Auth Flow
// ============================================================================

describe('Complete Auth Flow', () => {
  let authClient: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    authClient = createMockAuthClient();
    resetCookies();
  });

  it('should complete: Register -> Enable 2FA -> Add Passkey', async () => {
    // 1. Register
    const registerResult = await authClient.signUp.email({
      email: 'flow@test.com',
      password: 'SecurePass123!',
      name: 'Flow Test',
    });
    expect(registerResult.error).toBeNull();
    expect(authClient._getSession()).not.toBeNull();

    // 2. Enable 2FA
    const enable2FAResult = await authClient.twoFactor.enable({ password: 'SecurePass123!' });
    expect(enable2FAResult.error).toBeNull();
    expect(enable2FAResult.data?.totpURI).toBeDefined();

    // 3. Verify TOTP
    const verifyResult = await authClient.twoFactor.verifyTotp({ code: '123456' });
    expect(verifyResult.error).toBeNull();
    expect(authClient._getSession()?.user.twoFactorEnabled).toBe(true);

    // 4. Add Passkey
    const passkeyResult = await authClient.passkey.addPasskey({ name: 'Test Device' });
    expect(passkeyResult.error).toBeNull();
    expect(passkeyResult.data?.name).toBe('Test Device');
  });

  it('should complete: Register -> Add Passkey -> Enable 2FA', async () => {
    // 1. Register
    const registerResult = await authClient.signUp.email({
      email: 'flow2@test.com',
      password: 'SecurePass123!',
      name: 'Flow Test 2',
    });
    expect(registerResult.error).toBeNull();

    // 2. Add Passkey first
    const passkeyResult = await authClient.passkey.addPasskey({ name: 'Early Passkey' });
    expect(passkeyResult.error).toBeNull();

    // 3. Then enable 2FA
    const enable2FAResult = await authClient.twoFactor.enable({ password: 'SecurePass123!' });
    expect(enable2FAResult.error).toBeNull();

    // 4. Verify TOTP
    const verifyResult = await authClient.twoFactor.verifyTotp({ code: '123456' });
    expect(verifyResult.error).toBeNull();
    expect(authClient._getSession()?.user.twoFactorEnabled).toBe(true);
  });

  it('should complete: Login -> Logout -> Login with 2FA', async () => {
    // Setup: Register and enable 2FA
    await authClient.signUp.email({
      email: 'logout@test.com',
      password: 'SecurePass123!',
      name: 'Logout Test',
    });
    await authClient.twoFactor.enable({ password: 'SecurePass123!' });
    await authClient.twoFactor.verifyTotp({ code: '123456' });

    // 1. Logout
    await authClient.signOut();
    expect(authClient._getSession()).toBeNull();

    // 2. Login again
    const loginResult = await authClient.signIn.email({
      email: 'logout@test.com',
      password: 'SecurePass123!',
    });
    expect(loginResult.error).toBeNull();

    // Note: In real flow, 2FA would be required here
    // The mock simulates this by having twoFactorEnabled in the user object
  });
});

// ============================================================================
// Test Suite: Session Management
// ============================================================================

describe('Session Management', () => {
  let authClient: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    authClient = createMockAuthClient();
    resetCookies();
  });

  it('should start with no session', () => {
    const session = authClient._getSession();
    expect(session).toBeNull();
  });

  it('should create session on login', async () => {
    await authClient.signIn.email({
      email: 'test@example.com',
      password: 'SecurePass123!',
    });

    const session = authClient._getSession();
    expect(session).not.toBeNull();
    expect(session?.session.token).toBeDefined();
  });

  it('should preserve session data', async () => {
    await authClient.signIn.email({
      email: 'preserve@test.com',
      password: 'SecurePass123!',
    });

    const session = authClient._getSession();
    expect(session?.user.email).toBe('preserve@test.com');
    expect(session?.session.id).toBe('session-123');
  });
});
