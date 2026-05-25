// nest-server users carry roles as an array (`roles: string[]`); some Better Auth
// setups additionally expose a singular `role`. Accept either.
function isAdminUser(user: { role?: string; roles?: string[] } | null | undefined): boolean {
  return !!user?.roles?.includes('admin') || user?.role === 'admin';
}

export default defineNuxtRouteMiddleware(async (to) => {
  // Only check routes starting with /app/admin
  if (!to.path.startsWith('/app/admin')) {
    return;
  }

  // Cookie name is configurable via `ltExtensions.auth.cookieNames.state` in
  // nuxt.config.ts. Fall back to the historical default so older module
  // versions and missing config keep working unchanged.
  const cookieName = (useRuntimeConfig().public as { ltExtensions?: { auth?: { cookieNames?: { state?: string } } } })?.ltExtensions?.auth?.cookieNames?.state || 'lt-auth-state';

  let isAuthenticated = false;
  let isAdmin = false;

  // On client, read directly from document.cookie for accurate state
  if (import.meta.client) {
    try {
      const cookie = document.cookie.split('; ').find((row) => row.startsWith(`${cookieName}=`));
      if (cookie) {
        const parts = cookie.split('=');
        const value = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('=')) : '';
        const state = JSON.parse(value);
        isAuthenticated = !!state?.user;
        isAdmin = isAdminUser(state?.user);
      }
    } catch {
      // Ignore parse errors
    }
  } else {
    // On server, use useCookie
    const authStateCookie = useCookie<{ authMode: string; user: { role?: string; roles?: string[] } | null } | null>(cookieName);
    isAuthenticated = !!authStateCookie.value?.user;
    isAdmin = isAdminUser(authStateCookie.value?.user);
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return navigateTo({
      path: '/auth/login',
      query: { redirect: to.fullPath },
    });
  }

  // Redirect to /app if authenticated but not admin
  if (!isAdmin) {
    return navigateTo('/app');
  }
});
