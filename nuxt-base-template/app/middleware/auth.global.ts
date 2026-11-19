export default defineNuxtRouteMiddleware(async (to) => {
  // Only check routes starting with /app (but not /app/admin, handled by admin middleware)
  if (!to.path.startsWith('/app') || to.path.startsWith('/app/admin')) {
    return;
  }

  // The user as nuxt-extensions and /auth/callback see it: the cookie name honours
  // `cookieNames.state` and NUXT_PUBLIC_COOKIE_PREFIX, and of two auth-state cookies the one
  // with a user wins (app/utils/auth-state-user.ts).
  if (!readAuthStateUser()) {
    return navigateTo({
      path: '/auth/login',
      query: { redirect: to.fullPath },
    });
  }
});
