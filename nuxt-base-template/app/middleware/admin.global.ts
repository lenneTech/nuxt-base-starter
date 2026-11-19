// `isAdminUser` is the project's single source of truth for the dual-shape
// role check (`role: string` vs `roles: string[]`) — see app/utils/is-admin-user.ts.
// It is auto-imported by Nuxt.

export default defineNuxtRouteMiddleware(async (to) => {
  // Only check routes starting with /app/admin
  if (!to.path.startsWith('/app/admin')) {
    return;
  }

  // The user as nuxt-extensions and /auth/callback see it (app/utils/auth-state-user.ts).
  const user = readAuthStateUser();

  // Redirect to login if not authenticated
  if (!user) {
    return navigateTo({
      path: '/auth/login',
      query: { redirect: to.fullPath },
    });
  }

  // Redirect to /app if authenticated but not admin
  if (!isAdminUser(user)) {
    return navigateTo('/app');
  }
});
