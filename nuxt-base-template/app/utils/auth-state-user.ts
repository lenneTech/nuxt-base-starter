/**
 * The signed-in user as the route guards see it: auth.global, guest.global and admin.global.
 *
 * Read the way nuxt-extensions reads it (`resolveLtAuthState()` in its `lib/auth-state`, which the
 * package does not export): the cookie name from `getLtAuthCookieNames()`, which honours an explicit
 * `ltExtensions.auth.cookieNames.state` and `NUXT_PUBLIC_COOKIE_PREFIX` (`<prefix>-auth-state`), and
 * of several cookies with that name the first one that carries a user. A deployment can hold two,
 * a host-only one and a domain-scoped one, and the stale twin may come first. `/auth/callback`
 * decides with the library's `isLtAuthenticated()`, so a guard that read differently would send the
 * user it had just let in back to the login page, and a silent sign-in would start again.
 *
 * `lt-auth-state` is a cache for the app shell, not the session: every API call still
 * authenticates with the httpOnly session cookie. A guard only decides which page to show.
 *
 * Not `useLtAuth()`: in a route middleware, outside a component's effect scope, its `useCookie`
 * calls register a cookie listener per navigation that nothing removes (Nuxt 4.6, `cookie.js`).
 */

/** The fields a guard needs; the cookie carries the user as the API returned it. */
export interface AuthStateUser {
  [key: string]: unknown;
  role?: string;
  roles?: string[];
}

/**
 * Of all `<name>=` entries in a `Cookie` header or `document.cookie`, the user of the first one
 * that carries a user, or `null`. A malformed entry counts as one without a user.
 */
export function userFromAuthStateCookies(cookieString: string | undefined, name: string): AuthStateUser | null {
  const prefix = `${name}=`;
  for (const entry of (cookieString ?? '').split(/;\s*/)) {
    if (!entry.startsWith(prefix)) {
      continue;
    }
    try {
      const state = JSON.parse(decodeURIComponent(entry.slice(prefix.length))) as { user?: AuthStateUser | null } | null;
      if (state?.user) {
        return state.user;
      }
    } catch {
      // A malformed twin: keep looking.
    }
  }
  return null;
}

/**
 * The signed-in user for the current navigation, on the server and in the browser.
 *
 * In the browser it reads `document.cookie` afresh, as `isLtAuthenticated()` does. During a server
 * render it reads the request's `Cookie` header and then, as `useLtAuth()` does, the cookie this
 * render may have set itself.
 */
export function readAuthStateUser(): AuthStateUser | null {
  const name = getLtAuthCookieNames().state;
  if (import.meta.client) {
    return userFromAuthStateCookies(document.cookie, name);
  }
  return userFromAuthStateCookies(useRequestHeaders(['cookie']).cookie, name) ?? useCookie<{ user?: AuthStateUser | null } | null>(name).value?.user ?? null;
}
