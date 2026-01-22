import { authClient } from '~/lib/auth-client';
import { arrayBufferToBase64Url, base64UrlToUint8Array } from '~/utils/crypto';

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
  authMode: 'cookie' | 'jwt';
  user: BetterAuthUser | null;
}

/**
 * Result of passkey authentication
 */
interface PasskeyAuthResult {
  error?: string;
  session?: { token: string };
  success: boolean;
  user?: BetterAuthUser;
}

/**
 * Better Auth composable with client-side state management
 *
 * This composable manages auth state using:
 * 1. Primary: Session cookies (more secure, HttpOnly)
 * 2. Fallback: JWT tokens (when cookies are not available/working)
 *
 * The auth mode is automatically detected:
 * - If session cookie works → use cookies
 * - If cookies fail (401) → switch to JWT mode
 */
export function useBetterAuth() {
  // Use useCookie for SSR-compatible persistent state
  // Note: No default value to prevent overwriting existing cookies during hydration
  const authState = useCookie<StoredAuthState | null>('auth-state', {
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax',
  });

  // On client, sync from browser cookie to ensure we have the latest value
  // This prevents hydration mismatch where useCookie may return stale/null value
  if (import.meta.client) {
    try {
      const cookieStr = document.cookie.split('; ').find((row) => row.startsWith('auth-state='));
      if (cookieStr) {
        const parts = cookieStr.split('=');
        const value = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('=')) : '';
        if (value) {
          const parsed = JSON.parse(value);
          // Only update if the browser cookie has a user but useCookie doesn't
          if (parsed?.user && !authState.value?.user) {
            authState.value = parsed;
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Initialize with default only on server if cookie doesn't exist
  if (import.meta.server && (authState.value === null || authState.value === undefined)) {
    authState.value = { user: null, authMode: 'cookie' };
  }

  // JWT token storage (used when cookies are not available)
  const jwtToken = useCookie<string | null>('jwt-token', {
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax',
  });

  // Loading state
  const isLoading = ref<boolean>(false);

  // Auth mode: 'cookie' (default) or 'jwt' (fallback)
  const authMode = computed(() => authState.value?.authMode || 'cookie');
  const isJwtMode = computed(() => authMode.value === 'jwt');

  // Computed properties based on stored state
  const user = computed<BetterAuthUser | null>(() => authState.value?.user ?? null);
  const isAuthenticated = computed<boolean>(() => !!user.value);
  const isAdmin = computed<boolean>(() => user.value?.role === 'admin');
  const is2FAEnabled = computed<boolean>(() => user.value?.twoFactorEnabled ?? false);

  /**
   * Get the API base URL
   */
  function getApiBase(): string {
    const isDev = import.meta.dev;
    const runtimeConfig = useRuntimeConfig();
    return isDev ? '/api/iam' : `${runtimeConfig.public.apiUrl || 'http://localhost:3000'}/iam`;
  }

  /**
   * Set user data after successful login/signup
   * Also manually writes to browser cookie for SSR compatibility
   */
  function setUser(userData: BetterAuthUser | null, mode: 'cookie' | 'jwt' = 'cookie'): void {
    const newState = { user: userData, authMode: mode };
    authState.value = newState;

    // Manually write to browser cookie for immediate SSR compatibility
    if (import.meta.client) {
      const maxAge = 60 * 60 * 24 * 7; // 7 days
      document.cookie = `auth-state=${encodeURIComponent(JSON.stringify(newState))}; path=/; max-age=${maxAge}; samesite=lax`;
    }
  }

  /**
   * Clear user data on logout
   * Also manually clears browser cookies for SSR compatibility
   */
  function clearUser(): void {
    const clearedState = { user: null, authMode: 'cookie' as const };
    authState.value = clearedState;
    jwtToken.value = null;

    // Manually clear browser cookies for immediate SSR compatibility
    if (import.meta.client) {
      const maxAge = 60 * 60 * 24 * 7; // 7 days
      document.cookie = `auth-state=${encodeURIComponent(JSON.stringify(clearedState))}; path=/; max-age=${maxAge}; samesite=lax`;
      document.cookie = `jwt-token=; path=/; max-age=0`;

      // Clear Better Auth session cookies (set by the API)
      // These cookies may have different names depending on the configuration
      const sessionCookieNames = ['better-auth.session_token', 'better-auth.session', '__Secure-better-auth.session_token', 'session_token', 'session'];

      for (const name of sessionCookieNames) {
        // Clear with different path variations
        document.cookie = `${name}=; path=/; max-age=0`;
        document.cookie = `${name}=; path=/api; max-age=0`;
        document.cookie = `${name}=; path=/api/iam; max-age=0`;
        document.cookie = `${name}=; path=/iam; max-age=0`;
      }
    }
  }

  /**
   * Switch to JWT mode and fetch a token
   */
  async function switchToJwtMode(): Promise<boolean> {
    try {
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/token`, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          jwtToken.value = data.token;
          if (authState.value) {
            authState.value = { ...authState.value, authMode: 'jwt' };
          }
          console.debug('[Auth] Switched to JWT mode');
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Refresh JWT token before it expires
   */
  async function refreshJwtToken(): Promise<boolean> {
    if (!isJwtMode.value || !jwtToken.value) return false;
    return switchToJwtMode();
  }

  /**
   * Authenticated fetch wrapper
   * Uses cookies by default, falls back to JWT if cookies fail
   */
  async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers);

    // In JWT mode, add Authorization header
    if (isJwtMode.value && jwtToken.value) {
      headers.set('Authorization', `Bearer ${jwtToken.value}`);
    }

    const response = await fetch(url, {
      ...options,
      headers,
      // Only include credentials in cookie mode
      credentials: isJwtMode.value ? 'omit' : 'include',
    });

    // If we get 401 in cookie mode, try switching to JWT
    if (response.status === 401 && !isJwtMode.value && isAuthenticated.value) {
      console.debug('[Auth] Cookie auth failed, attempting JWT fallback...');
      const switched = await switchToJwtMode();

      if (switched) {
        // Retry the request with JWT
        headers.set('Authorization', `Bearer ${jwtToken.value}`);
        return fetch(url, {
          ...options,
          headers,
          credentials: 'omit',
        });
      }
    }

    return response;
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
        setUser(session.value.data.user as BetterAuthUser, 'cookie');
        // Pre-fetch JWT for fallback
        switchToJwtMode().catch(() => {});
        return true;
      }

      // Session not found from Better Auth API
      // Trust the stored auth-state if user exists (e.g., after 2FA verification)
      // The auth-state cookie is set by our application after successful login/2FA
      if (authState.value?.user) {
        // Pre-fetch JWT for fallback
        switchToJwtMode().catch(() => {});
        return true;
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

        // Extract token from response (JWT mode: cookies: false)
        const resultAny = result as any;
        const token = resultAny?.token || resultAny?.data?.token;
        const userData = resultAny?.user || resultAny?.data?.user;

        if (token) {
          // JWT mode: Token is in the response
          jwtToken.value = token;
          if (userData) {
            setUser(userData as BetterAuthUser, 'jwt');
          }
          console.debug('[Auth] JWT token received from login response');
        } else if (userData) {
          // Cookie mode: No token in response, use cookies
          setUser(userData as BetterAuthUser, 'cookie');
          // Try to get JWT token for fallback
          switchToJwtMode().catch(() => {});
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

        // Extract token from response (JWT mode: cookies: false)
        const resultAny = result as any;
        const token = resultAny?.token || resultAny?.data?.token;
        const userData = resultAny?.user || resultAny?.data?.user;

        if (token) {
          // JWT mode: Token is in the response
          jwtToken.value = token;
          if (userData) {
            setUser(userData as BetterAuthUser, 'jwt');
          }
          console.debug('[Auth] JWT token received from signup response');
        } else if (userData) {
          // Cookie mode: No token in response, use cookies
          setUser(userData as BetterAuthUser, 'cookie');
          switchToJwtMode().catch(() => {});
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

  /**
   * Authenticate with a passkey (WebAuthn)
   *
   * This function handles the complete WebAuthn authentication flow:
   * 1. Fetches authentication options from the server
   * 2. Prompts the user to select a passkey via the browser's WebAuthn API
   * 3. Sends the signed credential to the server for verification
   * 4. Stores user data on successful authentication
   *
   * @returns Result with success status, user data, or error message
   */
  async function authenticateWithPasskey(): Promise<PasskeyAuthResult> {
    isLoading.value = true;

    try {
      const apiBase = getApiBase();

      // Step 1: Get authentication options from server
      const optionsResponse = await fetchWithAuth(`${apiBase}/passkey/generate-authenticate-options`, {
        method: 'GET',
      });

      if (!optionsResponse.ok) {
        return { success: false, error: 'Konnte Passkey-Optionen nicht laden' };
      }

      const options = await optionsResponse.json();

      // Step 2: Convert challenge from base64url to ArrayBuffer
      const challengeBuffer = base64UrlToUint8Array(options.challenge).buffer as ArrayBuffer;

      // Step 3: Get credential from browser's WebAuthn API
      const credential = (await navigator.credentials.get({
        publicKey: {
          challenge: challengeBuffer,
          rpId: options.rpId,
          allowCredentials: options.allowCredentials || [],
          userVerification: options.userVerification,
          timeout: options.timeout,
        },
      })) as PublicKeyCredential | null;

      if (!credential) {
        return { success: false, error: 'Kein Passkey ausgewählt' };
      }

      // Step 4: Convert credential response to base64url format
      const response = credential.response as AuthenticatorAssertionResponse;
      const credentialBody = {
        id: credential.id,
        rawId: arrayBufferToBase64Url(credential.rawId),
        type: credential.type,
        response: {
          authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
          clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
          signature: arrayBufferToBase64Url(response.signature),
          userHandle: response.userHandle ? arrayBufferToBase64Url(response.userHandle) : null,
        },
        clientExtensionResults: credential.getClientExtensionResults?.() || {},
      };

      // Step 5: Verify with server
      // Note: The server expects { response: credentialData } format (matching @simplewebauthn/browser output)
      // Include challengeId for JWT mode (database challenge storage)
      const authResponse = await fetchWithAuth(`${apiBase}/passkey/verify-authentication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: options.challengeId, response: credentialBody }),
      });

      const result = await authResponse.json();

      if (!authResponse.ok) {
        return { success: false, error: result.message || 'Passkey-Anmeldung fehlgeschlagen' };
      }

      // Store user data after successful passkey login
      if (result.user) {
        setUser(result.user as BetterAuthUser, 'cookie');
        switchToJwtMode().catch(() => {});
      } else if (result.session?.token) {
        // Passkey auth returns session without user in JWT mode
        // Store the session token as JWT and fetch user via validateSession
        jwtToken.value = result.session.token;
        if (authState.value) {
          authState.value = { ...authState.value, authMode: 'jwt' };
        }
        console.debug('[Auth] Passkey: Stored session token as JWT');
      }

      return { success: true, user: result.user as BetterAuthUser, session: result.session };
    } catch (err: unknown) {
      // Handle WebAuthn-specific errors
      if (err instanceof Error && err.name === 'NotAllowedError') {
        return { success: false, error: 'Passkey-Authentifizierung wurde abgebrochen' };
      }
      return { success: false, error: err instanceof Error ? err.message : 'Passkey-Anmeldung fehlgeschlagen' };
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Register a new passkey for the current user
   *
   * This function handles the complete WebAuthn registration flow:
   * 1. Fetches registration options from the server
   * 2. Prompts the user to create a passkey via the browser's WebAuthn API
   * 3. Sends the credential to the server for storage
   *
   * @param name - Optional name for the passkey
   * @returns Result with success status or error message
   */
  async function registerPasskey(name?: string): Promise<{ success: boolean; error?: string; passkey?: any }> {
    isLoading.value = true;

    try {
      const apiBase = getApiBase();

      // Step 1: Get registration options from server
      const optionsResponse = await fetchWithAuth(`${apiBase}/passkey/generate-register-options`, {
        method: 'GET',
      });

      if (!optionsResponse.ok) {
        const error = await optionsResponse.json().catch(() => ({}));
        return { success: false, error: error.message || 'Konnte Registrierungsoptionen nicht laden' };
      }

      const options = await optionsResponse.json();

      // Step 2: Convert challenge from base64url to ArrayBuffer
      const challengeBuffer = base64UrlToUint8Array(options.challenge).buffer as ArrayBuffer;

      // Step 3: Convert user.id from base64url to ArrayBuffer
      const userIdBuffer = base64UrlToUint8Array(options.user.id).buffer as ArrayBuffer;

      // Step 4: Create credential via browser's WebAuthn API
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: challengeBuffer,
          rp: options.rp,
          user: {
            ...options.user,
            id: userIdBuffer,
          },
          pubKeyCredParams: options.pubKeyCredParams,
          timeout: options.timeout,
          attestation: options.attestation,
          authenticatorSelection: options.authenticatorSelection,
          excludeCredentials: (options.excludeCredentials || []).map((cred: any) => ({
            ...cred,
            id: base64UrlToUint8Array(cred.id).buffer as ArrayBuffer,
          })),
        },
      })) as PublicKeyCredential | null;

      if (!credential) {
        return { success: false, error: 'Passkey-Erstellung abgebrochen' };
      }

      // Step 5: Convert credential response to base64url format
      const attestationResponse = credential.response as AuthenticatorAttestationResponse;
      const credentialBody = {
        name,
        // Include challengeId for JWT mode (database challenge storage)
        challengeId: options.challengeId,
        response: {
          id: credential.id,
          rawId: arrayBufferToBase64Url(credential.rawId),
          type: credential.type,
          response: {
            attestationObject: arrayBufferToBase64Url(attestationResponse.attestationObject),
            clientDataJSON: arrayBufferToBase64Url(attestationResponse.clientDataJSON),
            transports: attestationResponse.getTransports?.() || [],
          },
          clientExtensionResults: credential.getClientExtensionResults?.() || {},
        },
      };

      // Step 6: Send to server for verification and storage
      const registerResponse = await fetchWithAuth(`${apiBase}/passkey/verify-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentialBody),
      });

      const result = await registerResponse.json();

      if (!registerResponse.ok) {
        return { success: false, error: result.message || 'Passkey-Registrierung fehlgeschlagen' };
      }

      return { success: true, passkey: result };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        return { success: false, error: 'Passkey-Erstellung wurde abgebrochen' };
      }
      return { success: false, error: err instanceof Error ? err.message : 'Passkey-Registrierung fehlgeschlagen' };
    } finally {
      isLoading.value = false;
    }
  }

  return {
    // Auth state
    authMode,
    isAuthenticated,
    isJwtMode,
    isLoading: computed(() => isLoading.value),
    user,

    // User properties
    is2FAEnabled,
    isAdmin,

    // Auth actions
    authenticateWithPasskey,
    changePassword: authClient.changePassword,
    clearUser,
    registerPasskey,
    setUser,
    signIn,
    signOut,
    signUp,
    validateSession,

    // JWT management
    fetchWithAuth,
    jwtToken,
    refreshJwtToken,
    switchToJwtMode,

    // Better Auth client passthrough
    passkey: authClient.passkey,
    twoFactor: authClient.twoFactor,
  };
}
