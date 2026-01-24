export default defineNuxtRouteMiddleware(async (to) => {
  // Only check routes starting with /app/admin
  if (!to.path.startsWith('/app/admin')) {
    return;
  }

  let isAuthenticated = false;
  let isAdmin = false;

  // On client, read directly from document.cookie for accurate state
  if (import.meta.client) {
    try {
      const cookie = document.cookie.split('; ').find((row) => row.startsWith('lt-auth-state='));
      if (cookie) {
        const parts = cookie.split('=');
        const value = parts.length > 1 ? decodeURIComponent(parts.slice(1).join('=')) : '';
        const state = JSON.parse(value);
        isAuthenticated = !!state?.user;
        isAdmin = state?.user?.role === 'admin';
      }
    } catch {
      // Ignore parse errors
    }
  } else {
    // On server, use useCookie
    const authStateCookie = useCookie<{ user: { role?: string } | null; authMode: string } | null>('lt-auth-state');
    isAuthenticated = !!authStateCookie.value?.user;
    isAdmin = authStateCookie.value?.user?.role === 'admin';
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
