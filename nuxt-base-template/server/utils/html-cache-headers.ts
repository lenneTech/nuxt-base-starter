/**
 * Decides the `Cache-Control` for an SSR HTML response.
 *
 * Lives here rather than inside `server/plugins/html-no-cache.ts` so it can be
 * unit-tested: importing the plugin file evaluates its `defineNitroPlugin(...)` call,
 * which only exists inside a Nitro runtime. The plugin is the three-line adapter;
 * this is the decision. (Nitro auto-imports `server/utils/`, so the plugin needs no
 * import statement.)
 *
 * ── What it does ────────────────────────────────────────────────────────────────
 * Mutates `headers` in place and reports whether it changed anything. In-place is
 * correct: `headers` is the object the renderer produced, and Nitro merges it onto
 * the response with a per-entry `setResponseHeader` loop — reassigning the property
 * would be a no-op self-assignment.
 *
 * ── Why `private`, and why `Vary: Cookie` ───────────────────────────────────────
 * `no-cache` means "revalidate before reuse", NOT "do not store". Without `private`
 * a SHARED cache (CDN, corporate proxy) is permitted to store the response — and
 * every `/app/**` page is per-user SSR output carrying the signed-in user's name and
 * e-mail. `private` is the directive that keeps it out of shared storage; `Vary:
 * Cookie` means a cache that ignores `private` still cannot hand one visitor's
 * document to another.
 */
export function applyHtmlCacheHeaders(headers: Record<string, string>, routeRuleCacheControl?: string): boolean {
  // Case-insensitive: the header bag is a plain object here rather than a
  // normalising `Headers` instance, so a `Content-Type` key would silently skip the
  // guard and leave the document uncached-but-unmarked.
  const contentType = Object.entries(headers).find(([key]) => key.toLowerCase() === 'content-type')?.[1] ?? '';
  if (!String(contentType).includes('text/html')) {
    return false;
  }

  // Never overrule an explicit caching decision. `routeRules` headers are applied to
  // the event BEFORE the handler runs, while this hook's headers are written after —
  // so without this bail-out a project that adds `swr`/`isr` or its own
  // `cache-control` would have it silently replaced here, disabling CDN caching of
  // HTML with no error and no warning.
  if (routeRuleCacheControl || Object.keys(headers).some((key) => key.toLowerCase() === 'cache-control')) {
    return false;
  }

  headers['cache-control'] = 'private, no-cache';
  headers.vary = headers.vary ? `${headers.vary}, Cookie` : 'Cookie';
  return true;
}
