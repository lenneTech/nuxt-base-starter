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
  user: BetterAuthUser | null;
}

/**
 * Result of passkey authentication
 */
interface PasskeyAuthResult {
  error?: string;
  success: boolean;
  user?: BetterAuthUser;
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

  // Auth token cookie (for 2FA sessions where no session cookie is set)
  const authToken = useCookie<string | null>('auth-token', {
    default: () => null,
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
      // In development, use the Nuxt proxy to ensure cookies are sent correctly
      // In production, use the direct API URL
      const isDev = import.meta.dev;
      const runtimeConfig = useRuntimeConfig();
      const apiBase = isDev ? '/api/iam' : `${runtimeConfig.public.apiUrl || 'http://localhost:3000'}/iam`;

      // Step 1: Get authentication options from server
      const optionsResponse = await fetch(`${apiBase}/passkey/generate-authenticate-options`, {
        method: 'GET',
        credentials: 'include',
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
      const authResponse = await fetch(`${apiBase}/passkey/verify-authentication`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: credentialBody }),
      });

      const result = await authResponse.json();

      if (!authResponse.ok) {
        return { success: false, error: result.message || 'Passkey-Anmeldung fehlgeschlagen' };
      }

      // Store user data after successful passkey login
      if (result.user) {
        setUser(result.user as BetterAuthUser);
      }

      return { success: true, user: result.user as BetterAuthUser };
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
      // In development, use the Nuxt proxy to ensure cookies are sent correctly
      // In production, use the direct API URL
      const isDev = import.meta.dev;
      const runtimeConfig = useRuntimeConfig();
      const apiBase = isDev ? '/api/iam' : `${runtimeConfig.public.apiUrl || 'http://localhost:3000'}/iam`;

      // Step 1: Get registration options from server
      const optionsResponse = await fetch(`${apiBase}/passkey/generate-register-options`, {
        method: 'GET',
        credentials: 'include',
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
      const registerResponse = await fetch(`${apiBase}/passkey/verify-registration`, {
        method: 'POST',
        credentials: 'include',
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
    authenticateWithPasskey,
    changePassword: authClient.changePassword,
    clearUser,
    is2FAEnabled,
    isAdmin,
    isAuthenticated,
    isLoading: computed(() => isLoading.value),
    passkey: authClient.passkey,
    registerPasskey,
    setUser,
    signIn,
    signOut,
    signUp,
    twoFactor: authClient.twoFactor,
    user,
    validateSession,
  };
}
