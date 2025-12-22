import { passkeyClient } from '@better-auth/passkey/client';
import { adminClient, twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/vue';

import { sha256 } from '~/utils/crypto';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Normalized response type for Better-Auth operations
 * The Vue client returns complex union types - this provides a consistent interface
 */
export interface AuthResponse {
  data?: null | {
    redirect?: boolean;
    token?: null | string;
    url?: string;
    user?: {
      createdAt?: Date;
      email?: string;
      emailVerified?: boolean;
      id?: string;
      image?: string;
      name?: string;
      updatedAt?: Date;
    };
  };
  error?: null | {
    code?: string;
    message?: string;
    status?: number;
  };
}

// =============================================================================
// Base Client Configuration
// =============================================================================

const baseClient = createAuthClient({
  basePath: '/iam', // IMPORTANT: Must match nest-server betterAuth.basePath, default: '/iam'
  baseURL: import.meta.env?.VITE_API_URL || process.env.API_URL || 'http://localhost:3000',
  plugins: [
    adminClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        navigateTo('/auth/2fa');
      },
    }),
    passkeyClient(),
  ],
});

// =============================================================================
// Auth Client with Password Hashing
// =============================================================================

/**
 * Extended auth client that hashes passwords before transmission.
 *
 * SECURITY: Passwords are hashed with SHA256 client-side to prevent
 * plain text password transmission over the network.
 *
 * The server's normalizePasswordForIam() detects SHA256 hashes (64 hex chars)
 * and processes them correctly.
 */
export const authClient = {
  // Spread all base client properties and methods
  ...baseClient,

  /**
   * Change password for an authenticated user (both passwords are hashed)
   */
  changePassword: async (params: { currentPassword: string; newPassword: string }, options?: any) => {
    const [hashedCurrent, hashedNew] = await Promise.all([sha256(params.currentPassword), sha256(params.newPassword)]);
    return baseClient.changePassword?.({ currentPassword: hashedCurrent, newPassword: hashedNew }, options);
  },

  /**
   * Reset password with token (new password is hashed before sending)
   */
  resetPassword: async (params: { newPassword: string; token: string }, options?: any) => {
    const hashedPassword = await sha256(params.newPassword);
    return baseClient.resetPassword?.({ newPassword: hashedPassword, token: params.token }, options);
  },

  // Override signIn to hash password
  signIn: {
    ...baseClient.signIn,
    /**
     * Sign in with email and password (password is hashed before sending)
     */
    email: async (params: { email: string; password: string; rememberMe?: boolean }, options?: any) => {
      const hashedPassword = await sha256(params.password);
      return baseClient.signIn.email({ ...params, password: hashedPassword }, options);
    },
  },

  // Explicitly pass through signOut (not captured by spread operator)
  signOut: baseClient.signOut,

  // Override signUp to hash password
  signUp: {
    ...baseClient.signUp,
    /**
     * Sign up with email and password (password is hashed before sending)
     */
    email: async (params: { email: string; name: string; password: string }, options?: any) => {
      const hashedPassword = await sha256(params.password);
      return baseClient.signUp.email({ ...params, password: hashedPassword }, options);
    },
  },

  // Override twoFactor to hash passwords
  twoFactor: {
    ...baseClient.twoFactor,
    /**
     * Disable 2FA (password is hashed before sending)
     */
    disable: async (params: { password: string }, options?: any) => {
      const hashedPassword = await sha256(params.password);
      return baseClient.twoFactor.disable({ password: hashedPassword }, options);
    },
    /**
     * Enable 2FA (password is hashed before sending)
     */
    enable: async (params: { password: string }, options?: any) => {
      const hashedPassword = await sha256(params.password);
      return baseClient.twoFactor.enable({ password: hashedPassword }, options);
    },
  },
};

export type AuthClient = typeof authClient;
