export default defineNuxtRouteMiddleware(async (to) => {
  // Only check routes starting with /app (but not /app/admin, handled by admin middleware)
  if (!to.path.startsWith('/app') || to.path.startsWith('/app/admin')) {
    return;
  }

  let isAuthenticated = false;

  // On client, read directly from document.cookie for accurate state
  if (import.meta.client) {
    try {
      const cookie = document.cookie.split('; ').find((row) => row.startsWith('auth-state='));
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
    const authStateCookie = useCookie<{ user: unknown; authMode: string } | null>('auth-state');
    isAuthenticated = !!authStateCookie.value?.user;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return navigateTo({
      path: '/auth/login',
      query: { redirect: to.fullPath },
    });
  }
});
