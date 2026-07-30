/**
 * Force the SSR entry document to always revalidate.
 *
 * By default an SSR HTML response carries no `Cache-Control` header, so a browser
 * applies heuristic freshness and may serve a cached OLD page after a deploy. That
 * page still references the OLD hashed `/_nuxt/*` bundles, so the app boots stale
 * code — a tester (or PO) then sees the pre-deploy build without a hard refresh.
 *
 * The fix: send `Cache-Control` on the HTML document so the browser must revalidate
 * before reusing it → after a deploy it re-fetches the fresh HTML, which references
 * the NEW bundle hashes. The hashed assets keep their
 * `public, max-age=31536000, immutable` header: they are served by Nitro's static
 * asset handler, which bypasses the renderer, so `render:response` (fired only for
 * SSR page renders) never touches them. The content-type check is a second guard.
 *
 * The decision itself — and the reasoning for `private` + `Vary: Cookie` — lives in
 * `server/utils/html-cache-headers.ts`, where it is unit-testable. This file is only
 * the wiring.
 *
 * ── Why no `ETag` ───────────────────────────────────────────────────────────────
 * `no-cache` mandates revalidation, and with no validator the browser cannot send a
 * conditional request — so every affected navigation is a full re-render plus a full
 * body transfer, never a 304. A body-hash ETag would fix the transfer half but not
 * the render half (the body must exist before it can be hashed), and on a per-user
 * document the ETag differs per user, so the hit rate is one browser against itself.
 * A poor trade for a validator that, computed over the wrong subset by mistake,
 * would serve one user's page to another. Deliberately omitted.
 *
 * ── Relationship to Nuxt's own app manifest ─────────────────────────────────────
 * `experimental.appManifest` (on by default) already detects a new build and reloads
 * — but only AFTER the stale document has booted: on the next route change, on an
 * `app:chunkError`, or when its poll fires (default 1 h). This plugin removes that
 * one stale boot. Genuinely additive, but also the whole of what it buys — if the
 * single reload is acceptable in a given project, deleting this file and lowering
 * `experimental.checkOutdatedBuildInterval` is the cheaper trade.
 *
 * To opt out entirely: delete this file. There is no runtime flag by design — a
 * caching default that can be toggled from the outside is one nobody can reason
 * about.
 */
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('render:response', (response, { event }) => {
    const headers = (response.headers ?? {}) as Record<string, string>;
    applyHtmlCacheHeaders(headers, getRouteRules(event).headers?.['cache-control']);
  });
});
