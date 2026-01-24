/**
 * Mock for Better-Auth Client
 *
 * Provides a fully mocked auth client for unit testing.
 * All methods return predictable mock data.
 */

import { vi } from 'vitest';
import { ref } from 'vue';

// Mock user data
export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  emailVerified: true,
  twoFactorEnabled: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock session data
export const mockSession = {
  id: 'session-123',
  userId: 'user-123',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  token: 'mock-session-token',
};

// Mock TOTP data
export const mockTotpData = {
  totpURI: 'otpauth://totp/Test:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Test',
  backupCodes: ['12345678', '23456789', '34567890', '45678901', '56789012'],
};

// Mock passkey data
export const mockPasskey = {
  id: 'passkey-123',
  name: 'Test Passkey',
  credentialID: 'credential-123',
  createdAt: new Date(),
};

// Create mock auth client
export function createMockAuthClient() {
  const sessionData = ref<{ user: typeof mockUser; session: typeof mockSession } | null>(null);

  return {
    // Session management
    useSession: vi.fn(() => ({
      data: sessionData,
      isPending: ref(false),
      error: ref(null),
    })),

    $fetch: vi.fn(),
    $store: {},
    $Infer: {} as any,

    // Sign in methods
    signIn: {
      email: vi.fn(async (params: { email: string; password: string }) => {
        if (params.email === 'invalid@test.com') {
          return { data: null, error: { message: 'Ungültige Anmeldedaten', code: 'LTNS_0010' } };
        }
        sessionData.value = { user: { ...mockUser, email: params.email }, session: mockSession };
        return { data: { user: mockUser, session: mockSession }, error: null };
      }),
      passkey: vi.fn(async () => {
        sessionData.value = { user: mockUser, session: mockSession };
        return { data: { user: mockUser, session: mockSession }, error: null };
      }),
    },

    // Sign up methods
    signUp: {
      email: vi.fn(async (params: { email: string; password: string; name: string }) => {
        const newUser = { ...mockUser, email: params.email, name: params.name };
        sessionData.value = { user: newUser, session: mockSession };
        return { data: { user: newUser, session: mockSession }, error: null };
      }),
    },

    // Sign out
    signOut: vi.fn(async () => {
      sessionData.value = null;
      return { data: null, error: null };
    }),

    // Password management
    changePassword: vi.fn(async () => ({ data: true, error: null })),
    resetPassword: vi.fn(async () => ({ data: true, error: null })),

    // Two-factor authentication
    twoFactor: {
      enable: vi.fn(async (params: { password: string }) => ({
        data: mockTotpData,
        error: null,
      })),
      disable: vi.fn(async (params: { password: string }) => {
        if (sessionData.value) {
          sessionData.value.user.twoFactorEnabled = false;
        }
        return { data: true, error: null };
      }),
      verifyTotp: vi.fn(async (params: { code: string }) => {
        if (params.code === '000000') {
          return { data: null, error: { message: 'Ungültiger Code' } };
        }
        if (sessionData.value) {
          sessionData.value.user.twoFactorEnabled = true;
        }
        return { data: { user: mockUser, session: mockSession }, error: null };
      }),
      verifyBackupCode: vi.fn(async (params: { code: string }) => ({
        data: { user: mockUser, session: mockSession },
        error: null,
      })),
      generateBackupCodes: vi.fn(async (params: { password: string }) => ({
        data: { backupCodes: mockTotpData.backupCodes },
        error: null,
      })),
    },

    // Passkey management
    passkey: {
      addPasskey: vi.fn(async (params: { name: string }) => ({
        data: { ...mockPasskey, name: params.name },
        error: null,
      })),
      deletePasskey: vi.fn(async (params: { id: string }) => ({ data: true, error: null })),
      listUserPasskeys: vi.fn(async () => ({
        data: [mockPasskey],
        error: null,
      })),
    },

    // Admin methods
    admin: {
      listUsers: vi.fn(async () => ({ data: [mockUser], error: null })),
      deleteUser: vi.fn(async () => ({ data: true, error: null })),
    },

    // Helper to set session state (for testing)
    _setSession: (user: typeof mockUser | null) => {
      if (user) {
        sessionData.value = { user, session: mockSession };
      } else {
        sessionData.value = null;
      }
    },

    // Helper to get current session state
    _getSession: () => sessionData.value,
  };
}

// Default mock instance
export const mockAuthClient = createMockAuthClient();

// Reset function for test cleanup
export function resetMockAuthClient(): void {
  mockAuthClient._setSession(null);
  vi.clearAllMocks();
}
