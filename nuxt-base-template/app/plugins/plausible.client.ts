import type { PlausibleEventOptions, PlausibleRequestPayload } from '@plausible-analytics/tracker';

import { init, track } from '@plausible-analytics/tracker';

import { defineNuxtPlugin, useHead, useRuntimeConfig } from '#imports';
import { analyticsReferrer, analyticsUrl } from '~/utils/analytics-url';

/**
 * Starts Plausible, and only while an analytics host is set explicitly.
 *
 * The host is `runtimeConfig.public.plausible.apiHost`: `NUXT_PLAUSIBLE_API_URL` at build time, or
 * `NUXT_PUBLIC_PLAUSIBLE_API_HOST` on the stage, which most stages use. Without one this plugin does
 * nothing, and `@nuxtjs/plausible` stays idle (`enabled: false` in `nuxt.config.ts`): no tracker,
 * no request, no preconnect.
 *
 * Why not the module's own plugin: it falls back to `https://plausible.io` without a host, and it
 * occupies the tracker's `transformRequest`. Here that hook passes the URL and the referrer of every
 * event, custom events included, through the masks of `app/utils/analytics-url.ts`.
 *
 * The tracker's automatic link, download and form capture stays off, whatever the module options
 * say: those events carry the clicked address as a property, which the masks do not see. Pageviews
 * come from `plausible-pageviews.client.ts`; `plausible.autoPageviews` stays `false`.
 */
export default defineNuxtPlugin({
  name: 'lt:plausible',
  // Before `plausible-pageviews.client.ts`, which reports through `$plausible`.
  enforce: 'pre',
  setup() {
    const options: Record<string, unknown> = useRuntimeConfig().public.plausible ?? {};
    const apiHost = configuredHost(options.apiHost);
    if (!apiHost) {
      return;
    }

    const ignoredHostnames = Array.isArray(options.ignoredHostnames)
      ? options.ignoredHostnames.filter((hostname): hostname is string => typeof hostname === 'string')
      : ['localhost'];
    const isIgnoredHostname = hostnameFilter(ignoredHostnames, options.ignoreSubDomains === true);

    init({
      autoCapturePageviews: false,
      captureOnLocalhost: !ignoredHostnames.includes('localhost'),
      domain: (typeof options.domain === 'string' && options.domain.trim()) || window.location.hostname,
      endpoint: `${apiHost.replace(/\/+$/, '')}/api/event`,
      fileDownloads: false,
      formSubmissions: false,
      // `analyticsUrl` drops the fragment, so hash routes would all report the same page.
      hashBasedRouting: false,
      logging: options.logIgnoredEvents === true,
      outboundLinks: false,
      transformRequest: (payload: PlausibleRequestPayload) =>
        isIgnoredHostname(window.location.hostname) ? null : { ...payload, r: analyticsReferrer(payload.r), u: analyticsUrl(payload.u) },
    });

    if (!apiHost.startsWith('/')) {
      useHead({ link: [{ href: apiHost, rel: 'preconnect' }] });
    }

    return {
      provide: {
        plausible: {
          trackEvent(eventName: string, eventOptions?: PlausibleEventOptions): void {
            track(eventName, eventOptions ?? {});
          },
          trackPageview(eventOptions?: PlausibleEventOptions): void {
            track('pageview', eventOptions ?? {});
          },
        },
      },
    };
  },
});

/** The host, when one is set. `NUXT_PUBLIC_*` values pass `destr()`, so a stage can hand over a non-string. */
function configuredHost(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** The module's own rule for `ignoredHostnames` beyond `localhost`, which the tracker handles itself. */
function hostnameFilter(ignoredHostnames: string[], ignoreSubDomains: boolean): (hostname: string) => boolean {
  const ignored = ignoredHostnames.filter((hostname) => hostname !== 'localhost');
  return (hostname) => ignored.some((entry) => hostname === entry || (ignoreSubDomains && hostname.endsWith(`.${entry}`)));
}
