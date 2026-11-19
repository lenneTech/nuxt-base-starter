// Removes the provider's error text from the login URL before the page renders.
//
// After a refused or silent sign-in through a social provider, Better Auth sends the browser to
// `errorCallbackURL` (`/auth/login`) with `?error=<code>&error_description=<text>`. Microsoft puts a
// long text with trace and correlation ids into the description. The page shows a fixed text for the
// code only, but a rendered request would still carry the description: in the SSR payload
// (`window.__NUXT__.path`), in the address bar and the history, and within reach of analytics and the
// bug reporter. So the request goes, before anything renders, to the same route without that one
// parameter: a 302 on the server, a `replace` on the client. `error`, `redirect` and every other
// parameter stay; `login.vue` reads the code once and removes `error` itself.
//
// The file name makes it run after `guest.global.ts` (Nuxt orders global middleware by file name),
// so a signed-in visitor still goes straight to the deep link, as before.

export default defineNuxtRouteMiddleware((to) => {
  if (to.path !== '/auth/login' || !('error_description' in to.query)) {
    return;
  }

  return navigateTo({ hash: to.hash, path: to.path, query: withoutProviderErrorText(to.query) }, { redirectCode: 302, replace: true });
});
