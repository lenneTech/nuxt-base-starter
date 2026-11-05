import type { CustomProperties, PlausibleEventOptions, PlausibleRequestPayload } from '@plausible-analytics/tracker';

import type { IsStaticRoute } from '~/utils/analytics-url';

import { init, track } from '@plausible-analytics/tracker';

import { defineNuxtPlugin, useHead, useRouter, useRuntimeConfig } from '#imports';
import { analyticsReferrer, analyticsUrl, staticRoutes } from '~/utils/analytics-url';

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
 * event, custom events included, through the masks of `app/utils/analytics-url.ts`, and so does the
 * `url` property the tracker adds by itself to a click on an element tagged
 * `plausible-event-name=…` (see `maskedProps`).
 *
 * The tracker's automatic outbound link, download and form capture stays off, whatever the module
 * options say. Pageviews come from `plausible-pageviews.client.ts`; `plausible.autoPageviews` stays
 * `false`. Other props are the caller's: no e-mail, no name, no id in them.
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
    // After `nuxt:router`, which is a core plugin and runs before every `pre` plugin of the app.
    const isStaticRoute = staticRoutes(useRouter());

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
        isIgnoredHostname(window.location.hostname)
          ? null
          : { ...payload, ...(payload.p ? { p: maskedProps(payload.p, isStaticRoute) } : {}), r: analyticsReferrer(payload.r), u: analyticsUrl(payload.u, isStaticRoute) },
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

/**
 * The props with the `url` the tracker adds by itself masked like the page URL.
 *
 * `init()` always listens for clicks on elements tagged `plausible-event-name=…` (Plausible's no-code
 * events), and for a link it sets `props.url` to the full `href`: query, record id, token and all, or
 * the address of a `mailto:` link. Anything that is no web address is dropped.
 */
function maskedProps(props: CustomProperties, isStaticRoute: IsStaticRoute): CustomProperties {
  const { url, ...rest } = props;
  if (url === undefined) {
    return props;
  }
  return typeof url === 'string' && /^https?:\/\//i.test(url) ? { ...rest, url: analyticsUrl(url, isStaticRoute) } : rest;
}

/** The module's own rule for `ignoredHostnames` beyond `localhost`, which the tracker handles itself. */
function hostnameFilter(ignoredHostnames: string[], ignoreSubDomains: boolean): (hostname: string) => boolean {
  const ignored = ignoredHostnames.filter((hostname) => hostname !== 'localhost');
  return (hostname) => ignored.some((entry) => hostname === entry || (ignoreSubDomains && hostname.endsWith(`.${entry}`)));
}
