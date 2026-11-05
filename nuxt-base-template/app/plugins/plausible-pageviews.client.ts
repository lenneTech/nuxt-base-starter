/** Absent while Plausible is switched off. See `reportPageviews` for why this is not the tracker's job. */
export default defineNuxtPlugin((nuxtApp) => {
  const { $plausible } = nuxtApp;
  if ($plausible) {
    reportPageviews((options) => $plausible.trackPageview(options), useRouter());
  }
});
