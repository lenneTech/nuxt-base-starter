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

/**
 * Configuration options for the auth client factory
 * All options have sensible defaults for nest-server compatibility
 */
export interface AuthClientConfig {
  /** API base URL (default: from env or http://localhost:3000) */
  baseURL?: string;
  /** Auth API base path (default: '/iam' - must match nest-server betterAuth.basePath) */
  basePath?: string;
  /** 2FA redirect path (default: '/auth/2fa') */
  twoFactorRedirectPath?: string;
  /** Enable admin plugin (default: true) */
  enableAdmin?: boolean;
  /** Enable 2FA plugin (default: true) */
  enableTwoFactor?: boolean;
  /** Enable passkey plugin (default: true) */
  enablePasskey?: boolean;
}

// =============================================================================
// Auth Client Factory
// =============================================================================

/**
 * Creates a configured Better-Auth client with password hashing
 *
 * This factory function allows creating auth clients with custom configuration,
 * making it reusable across different projects.
 *
 * @example
 * ```typescript
 * // Default configuration (works with nest-server defaults)
 * const authClient = createBetterAuthClient();
 *
 * // Custom configuration
 * const authClient = createBetterAuthClient({
 *   baseURL: 'https://api.example.com',
 *   basePath: '/auth',
 *   twoFactorRedirectPath: '/login/2fa',
 * });
 * ```
 *
 * SECURITY: Passwords are hashed with SHA256 client-side to prevent
 * plain text password transmission over the network.
 */
export function createBetterAuthClient(config: AuthClientConfig = {}) {
  // In development, use empty baseURL and /api/iam path to leverage Nuxt server proxy
  // This ensures cookies are properly forwarded for cross-origin requests (especially WebAuthn/Passkey)
  const isDev = import.meta.env?.DEV || process.env.NODE_ENV === 'development';
  const defaultBaseURL = isDev ? '' : (import.meta.env?.VITE_API_URL || process.env.API_URL || 'http://localhost:3000');
  // In development, use /api/iam (proxied through Nuxt server) instead of /iam
  const defaultBasePath = isDev ? '/api/iam' : '/iam';

  const {
    baseURL = defaultBaseURL,
    basePath = defaultBasePath,
    twoFactorRedirectPath = '/auth/2fa',
    enableAdmin = true,
    enableTwoFactor = true,
    enablePasskey = true,
  } = config;

  // Build plugins array based on configuration
  const plugins: any[] = [];

  if (enableAdmin) {
    plugins.push(adminClient());
  }

  if (enableTwoFactor) {
    plugins.push(
      twoFactorClient({
        onTwoFactorRedirect() {
          navigateTo(twoFactorRedirectPath);
        },
      }),
    );
  }

  if (enablePasskey) {
    plugins.push(passkeyClient());
  }

  // Create base client with configuration
  const baseClient = createAuthClient({
    basePath,
    baseURL,
    fetchOptions: {
      credentials: 'include', // Required for cross-origin cookie handling
    },
    plugins,
  });

  // Return extended client with password hashing
  return {
    // Spread all base client properties and methods
    ...baseClient,

    // Explicitly pass through methods not captured by spread operator
    useSession: baseClient.useSession,
    passkey: (baseClient as any).passkey,
    admin: (baseClient as any).admin,
    $Infer: baseClient.$Infer,
    $fetch: baseClient.$fetch,
    $store: baseClient.$store,

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

    // Override signIn to hash password (keep passkey method from plugin)
    signIn: {
      ...baseClient.signIn,
      /**
       * Sign in with email and password (password is hashed before sending)
       */
      email: async (params: { email: string; password: string; rememberMe?: boolean }, options?: any) => {
        const hashedPassword = await sha256(params.password);
        return baseClient.signIn.email({ ...params, password: hashedPassword }, options);
      },
      /**
       * Sign in with passkey (pass through to base client - provided by passkeyClient plugin)
       * @see https://www.better-auth.com/docs/plugins/passkey
       */
      passkey: (baseClient.signIn as any).passkey,
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

    // Override twoFactor to hash passwords (provided by twoFactorClient plugin)
    twoFactor: {
      ...(baseClient as any).twoFactor,
      /**
       * Disable 2FA (password is hashed before sending)
       */
      disable: async (params: { password: string }, options?: any) => {
        const hashedPassword = await sha256(params.password);
        return (baseClient as any).twoFactor.disable({ password: hashedPassword }, options);
      },
      /**
       * Enable 2FA (password is hashed before sending)
       */
      enable: async (params: { password: string }, options?: any) => {
        const hashedPassword = await sha256(params.password);
        return (baseClient as any).twoFactor.enable({ password: hashedPassword }, options);
      },
      /**
       * Verify TOTP code (pass through to base client)
       */
      verifyTotp: (baseClient as any).twoFactor.verifyTotp,
      /**
       * Verify backup code (pass through to base client)
       */
      verifyBackupCode: (baseClient as any).twoFactor.verifyBackupCode,
    },
  };
}

// =============================================================================
// Default Auth Client Instance
// =============================================================================

/**
 * Default auth client instance with standard nest-server configuration
 * Use createBetterAuthClient() for custom configuration
 */
export const authClient = createBetterAuthClient();

export type AuthClient = ReturnType<typeof createBetterAuthClient>;
