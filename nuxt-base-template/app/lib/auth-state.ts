/**
 * Shared authentication state for Cookie/JWT dual-mode authentication
 *
 * This module provides a reactive state that is shared between:
 * - auth-client.ts (uses it for customFetch)
 * - use-better-auth.ts (manages the state)
 *
 * Auth Mode Strategy:
 * 1. Primary: Session cookies (more secure, HttpOnly)
 * 2. Fallback: JWT tokens (when cookies are not available/working)
 *
 * The state is persisted in cookies for SSR compatibility.
 */

export type AuthMode = 'cookie' | 'jwt';

/**
 * Get the current auth mode from cookie
 */
export function getAuthMode(): AuthMode {
  if (import.meta.server) return 'cookie';

  try {
    const cookie = document.cookie.split('; ').find((row) => row.startsWith('auth-state='));
    if (cookie) {
      const parts = cookie.split('=');
      const value = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('=')) : '';
      const state = JSON.parse(value);
      return state?.authMode || 'cookie';
    }
  } catch {
    // Ignore parse errors
  }
  return 'cookie';
}

/**
 * Get the JWT token from cookie
 */
export function getJwtToken(): string | null {
  if (import.meta.server) return null;

  try {
    const cookie = document.cookie.split('; ').find((row) => row.startsWith('jwt-token='));
    if (cookie) {
      const parts = cookie.split('=');
      const value = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('=')) : '';
      // Handle JSON-encoded string (useCookie stores as JSON)
      if (value.startsWith('"') && value.endsWith('"')) {
        return JSON.parse(value);
      }
      return value || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Set JWT token in cookie
 */
export function setJwtToken(token: string | null): void {
  if (import.meta.server) return;

  const maxAge = 60 * 60 * 24 * 7; // 7 days
  if (token) {
    document.cookie = `jwt-token=${encodeURIComponent(JSON.stringify(token))}; path=/; max-age=${maxAge}; samesite=lax`;
  } else {
    document.cookie = `jwt-token=; path=/; max-age=0`;
  }
}

/**
 * Update auth mode in the auth-state cookie
 */
export function setAuthMode(mode: AuthMode): void {
  if (import.meta.server) return;

  try {
    const cookie = document.cookie.split('; ').find((row) => row.startsWith('auth-state='));

    let state = { user: null, authMode: mode };
    if (cookie) {
      const parts = cookie.split('=');
      const value = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('=')) : '';
      state = { ...JSON.parse(value), authMode: mode };
    }

    const maxAge = 60 * 60 * 24 * 7; // 7 days
    document.cookie = `auth-state=${encodeURIComponent(JSON.stringify(state))}; path=/; max-age=${maxAge}; samesite=lax`;
  } catch {
    // Ignore errors
  }
}

/**
 * Get the API base URL
 */
export function getApiBase(): string {
  const isDev = import.meta.dev;
  if (isDev) {
    return '/api/iam';
  }
  // In production, try to get from runtime config or fall back to default
  if (typeof window !== 'undefined' && (window as any).__NUXT__?.config?.public?.apiUrl) {
    return `${(window as any).__NUXT__.config.public.apiUrl}/iam`;
  }
  return 'http://localhost:3000/iam';
}

/**
 * Attempt to switch to JWT mode by fetching a token
 */
export async function attemptJwtSwitch(): Promise<boolean> {
  try {
    const apiBase = getApiBase();
    const response = await fetch(`${apiBase}/token`, {
      method: 'GET',
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      if (data.token) {
        setJwtToken(data.token);
        setAuthMode('jwt');
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
 * Check if user is authenticated (has auth-state with user)
 */
export function isAuthenticated(): boolean {
  if (import.meta.server) return false;

  try {
    const cookie = document.cookie.split('; ').find((row) => row.startsWith('auth-state='));
    if (cookie) {
      const parts = cookie.split('=');
      const value = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('=')) : '';
      const state = JSON.parse(value);
      return !!state?.user;
    }
  } catch {
    // Ignore parse errors
  }
  return false;
}

/**
 * Custom fetch function that handles Cookie/JWT dual-mode authentication
 *
 * This function:
 * 1. In cookie mode: Uses credentials: 'include'
 * 2. In JWT mode: Adds Authorization header
 * 3. On 401 in cookie mode: Attempts to switch to JWT and retries
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const authMode = getAuthMode();
  const jwtToken = getJwtToken();

  const headers = new Headers(init?.headers);

  // In JWT mode, add Authorization header
  if (authMode === 'jwt' && jwtToken) {
    headers.set('Authorization', `Bearer ${jwtToken}`);
  }

  // Always include credentials for cookie-based session auth
  // In JWT mode, cookies are sent but ignored by the server (Authorization header is used instead)
  // This is more robust than conditionally omitting cookies
  const response = await fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });

  // If we get 401 in cookie mode and user is authenticated, try JWT fallback
  if (response.status === 401 && authMode === 'cookie' && isAuthenticated()) {
    console.debug('[Auth] Cookie auth failed, attempting JWT fallback...');
    const switched = await attemptJwtSwitch();

    if (switched) {
      // Retry the request with JWT
      const newToken = getJwtToken();
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(input, {
          ...init,
          headers,
          credentials: 'include',
        });
      }
    }
  }

  return response;
}
