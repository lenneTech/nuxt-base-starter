/**
 * Query parameters analytics may see: the ones Plausible reports on.
 *
 * An allowlist on purpose. Auth links carry live secrets in the query, a reset token can set
 * somebody's password, and the next page with a secret of its own must not depend on somebody
 * remembering to extend a denylist.
 */
const REPORTED_PARAMS = ['ref', 'source', 'utm_campaign', 'utm_content', 'utm_medium', 'utm_source', 'utm_term'];

/** The page URL without anything but {@link REPORTED_PARAMS}. */
export function analyticsUrl(href: string): string {
  const url = new URL(href);
  const reported = new URLSearchParams();
  for (const name of REPORTED_PARAMS) {
    const value = url.searchParams.get(name);
    if (value !== null) {
      reported.set(name, value);
    }
  }
  const query = reported.toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
}

/**
 * Sends pageviews with {@link analyticsUrl}, the way the tracker's own capture does otherwise.
 *
 * That capture has to stay off (`plausible.autoPageviews`). It reports `location.href` the moment
 * the tracker starts, before any page can strip a token, and the `engagement` event repeats the
 * pageview's URL when the page is left. The module offers no hook into the request.
 */
export function reportPageviews(report: (options: { url: string }) => void, router: { afterEach: (hook: () => void) => unknown }): void {
  const reportCurrentPage = (): void => report({ url: analyticsUrl(window.location.href) });
  let reportedPath = window.location.pathname;

  reportCurrentPage();

  router.afterEach(() => {
    // Only a new path counts: stripping a token replaces the URL on the same page.
    if (window.location.pathname !== reportedPath) {
      reportedPath = window.location.pathname;
      reportCurrentPage();
    }
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      reportCurrentPage();
    }
  });
}
