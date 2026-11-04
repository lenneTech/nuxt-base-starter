// The AI pages exist only while the API runs its AI module. nest-server answers `GET /ai/status`
// with 404 when it is off, which is the default in nest-server-starter; `useLtAiStatus()`
// (nuxt-extensions) asks once per app start and shares the answer. It is loaded for every /app
// route, so the layout's AI navigation is right on the first render; an AI route opened while the
// module is off goes to /app instead of a page whose every request fails. `isAiRoute()` lists the
// routes (app/utils/ai-routes.ts).

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/app')) {
    return;
  }

  const { enabled, load } = useLtAiStatus();
  await load();

  if (isAiRoute(to.path) && !enabled.value) {
    return navigateTo('/app');
  }
});
