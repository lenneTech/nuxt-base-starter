export default defineNuxtRouteMiddleware(async (to) => {
  // Only check /auth/login route
  if (to.path !== '/auth/login') {
    return;
  }

  // Cookie name is configurable via `ltExtensions.auth.cookieNames.state` in
  // nuxt.config.ts. Fall back to the historical default so older module
  // versions and missing config keep working unchanged.
  const cookieName = (useRuntimeConfig().public as { ltExtensions?: { auth?: { cookieNames?: { state?: string } } } })?.ltExtensions?.auth?.cookieNames?.state || 'lt-auth-state';

  let isAuthenticated = false;

  // On client, read directly from document.cookie for accurate state
  if (import.meta.client) {
    try {
      const cookie = document.cookie.split('; ').find((row) => row.startsWith(`${cookieName}=`));
      if (cookie) {
        const parts = cookie.split('=');
        const value = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('=')) : '';
        const state = JSON.parse(value);
        isAuthenticated = !!state?.user;
      }
    } catch {
      // Ignore parse errors
    }
  } else {
    // On server, use useCookie
    const authStateCookie = useCookie<{ user: unknown; authMode: string } | null>(cookieName);
    isAuthenticated = !!authStateCookie.value?.user;
  }

  // Redirect to /app (or redirect query) if already authenticated
  if (isAuthenticated) {
    const redirect = to.query.redirect as string;
    return navigateTo(redirect || '/app');
  }
});
