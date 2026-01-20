import { authClient } from '~/lib/auth-client';

/**
 * User type for Better Auth session
 */
interface BetterAuthUser {
  email: string;
  emailVerified?: boolean;
  id: string;
  name?: string;
  role?: string;
  twoFactorEnabled?: boolean;
}

/**
 * Stored auth state (persisted in cookie for SSR compatibility)
 */
interface StoredAuthState {
  user: BetterAuthUser | null;
}

/**
 * Better Auth composable with client-side state management
 *
 * This composable manages auth state using:
 * 1. Client-side state stored in a cookie (for SSR compatibility)
 * 2. Better Auth's session endpoint as a validation check
 *
 * The state is populated after login and cleared on logout.
 */
export function useBetterAuth() {
  // Use useCookie for SSR-compatible persistent state
  const authState = useCookie<StoredAuthState>('auth-state', {
    default: () => ({ user: null }),
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax',
  });

  // Loading state
  const isLoading = ref<boolean>(false);

  // Computed properties based on stored state
  const user = computed<BetterAuthUser | null>(() => authState.value?.user ?? null);
  const isAuthenticated = computed<boolean>(() => !!user.value);
  const isAdmin = computed<boolean>(() => user.value?.role === 'admin');
  const is2FAEnabled = computed<boolean>(() => user.value?.twoFactorEnabled ?? false);

  /**
   * Set user data after successful login/signup
   */
  function setUser(userData: BetterAuthUser | null): void {
    authState.value = { user: userData };
  }

  /**
   * Clear user data on logout
   */
  function clearUser(): void {
    authState.value = { user: null };
  }

  /**
   * Validate session with backend (called on app init)
   * If session is invalid, clear the stored state
   */
  async function validateSession(): Promise<boolean> {
    try {
      // Try to get session from Better Auth
      const session = authClient.useSession();

      // Wait for session to load
      if (session.value.isPending) {
        await new Promise((resolve) => {
          const unwatch = watch(
            () => session.value.isPending,
            (isPending) => {
              if (!isPending) {
                unwatch();
                resolve(true);
              }
            },
            { immediate: true },
          );
        });
      }

      // If session has user data, update our state
      if (session.value.data?.user) {
        setUser(session.value.data.user as BetterAuthUser);
        return true;
      }

      // Session not found - check if we have a stored token cookie
      // If we have auth-state but no session, it might be a mismatch
      // For now, trust the stored state if token cookie exists
      const tokenCookie = useCookie('token');
      if (tokenCookie.value && authState.value?.user) {
        // We have both token and stored user - trust it
        return true;
      }

      // No valid session found - clear state
      if (authState.value?.user) {
        clearUser();
      }
      return false;
    } catch (error) {
      console.debug('Session validation failed:', error);
      return !!authState.value?.user;
    }
  }

  /**
   * Sign in with email and password
   */
  const signIn = {
    ...authClient.signIn,
    email: async (params: { email: string; password: string; rememberMe?: boolean }, options?: any) => {
      isLoading.value = true;
      try {
        const result = await authClient.signIn.email(params, options);

        // Check for successful response with user data
        if (result && 'user' in result && result.user) {
          setUser(result.user as BetterAuthUser);
        } else if (result && 'data' in result && result.data?.user) {
          setUser(result.data.user as BetterAuthUser);
        }

        return result;
      } finally {
        isLoading.value = false;
      }
    },
  };

  /**
   * Sign up with email and password
   */
  const signUp = {
    ...authClient.signUp,
    email: async (params: { email: string; name: string; password: string }, options?: any) => {
      isLoading.value = true;
      try {
        const result = await authClient.signUp.email(params, options);

        // Check for successful response with user data
        if (result && 'user' in result && result.user) {
          setUser(result.user as BetterAuthUser);
        } else if (result && 'data' in result && result.data?.user) {
          setUser(result.data.user as BetterAuthUser);
        }

        return result;
      } finally {
        isLoading.value = false;
      }
    },
  };

  /**
   * Sign out
   */
  const signOut = async (options?: any) => {
    isLoading.value = true;
    try {
      const result = await authClient.signOut(options);
      // Clear user data on logout
      clearUser();
      return result;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    changePassword: authClient.changePassword,
    clearUser,
    is2FAEnabled,
    isAdmin,
    isAuthenticated,
    isLoading: computed(() => isLoading.value),
    passkey: authClient.passkey,
    setUser,
    signIn,
    signOut,
    signUp,
    twoFactor: authClient.twoFactor,
    user,
    validateSession,
  };
}
