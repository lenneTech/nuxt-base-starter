export default defineNuxtRouteMiddleware(async (to) => {
  // Only check /auth/login route
  if (to.path !== '/auth/login') {
    return;
  }

  // The user as nuxt-extensions and /auth/callback see it (app/utils/auth-state-user.ts).
  //
  // Redirect to /app (or the recorded deep link) if already authenticated.
  //
  // `safeRedirectTarget` rather than a raw read: this runs in SSR middleware with no
  // try/catch around it, so an unvalidated cross-origin value reaching `navigateTo`
  // throws and surfaces as an error page instead of the app. It is also the same
  // validator `login.vue` and `2fa.vue` use — one query parameter, one rule. The
  // previous `as string` cast was a lie: `?redirect=/a&redirect=/b` yields an array.
  if (readAuthStateUser()) {
    return navigateTo(safeRedirectTarget(to.query.redirect));
  }
});
