/**
 * Decides the security headers for a response.
 *
 * Lives here rather than inside `server/plugins/security-headers.ts` so it can be
 * unit-tested: importing the plugin file evaluates its `defineNitroPlugin(...)` call,
 * which only exists inside a Nitro runtime. The plugin is the adapter; this is the
 * decision. (Nitro auto-imports `server/utils/`, so the plugin needs no import.)
 *
 * ── Why these headers, and why here ─────────────────────────────────────────────
 * Neither this template nor the API sent any of them: a deployed app answered with
 * `x-powered-by: Nuxt` and nothing else. Every one below is a browser-side mitigation
 * that costs nothing to send and cannot be added later by the application code —
 * only by whoever owns the response.
 *
 * The same set is hand-rolled in `projects/api/src/main.ts` across several customer
 * projects (svl, volksbank/imo). Rebuilding it per project is how it ends up missing
 * in the ones nobody audited, which is the case this file closes for every project
 * generated from this template.
 *
 * ── What is deliberately NOT here: Content-Security-Policy ──────────────────────
 * A CSP is the one header in this family that breaks a working app when it is wrong,
 * and a correct one depends on what the project actually loads — fonts, analytics,
 * an embedded map, a payment iframe. A template cannot know that, and a CSP shipped
 * "to be safe" would either be so permissive it protects nothing, or break the first
 * project that adds a third-party script. It belongs in the project, per project,
 * with its own testing. `docs/security-headers.md` says how.
 *
 * ── HSTS is conditional, and that is not caution but correctness ────────────────
 * `Strict-Transport-Security` tells a browser to refuse plain HTTP for this host,
 * and browsers REMEMBER it. Sent from a dev server on `localhost`, it can make every
 * other local project on `http://localhost` unreachable in that browser, for a year,
 * with no obvious way back. It is therefore sent only on a request that actually
 * arrived over HTTPS — never inferred from an env var, because a misconfigured env
 * is exactly the case that would poison a developer's browser.
 */

/** Headers every response carries. None of them can break a correctly built app. */
const ALWAYS: Readonly<Record<string, string>> = Object.freeze({
  // Stops a browser from second-guessing a declared Content-Type — the vector that
  // turns an uploaded "image" into an executed script.
  'X-Content-Type-Options': 'nosniff',
  // Clickjacking. `DENY` rather than `SAMEORIGIN`: a project that genuinely needs to
  // be framed knows it and can override, while the default protects the ones that
  // never thought about it.
  'X-Frame-Options': 'DENY',
  // Drops the path and query from cross-origin referrers, so a password-reset or
  // invite URL cannot leak to a third-party host through a link click.
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Denies powerful features the template does not use. A project that adds a camera
  // feature overrides this; the point is that it must be a decision.
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  // No speculative DNS lookups for links in user content.
  'X-DNS-Prefetch-Control': 'off',
  // Legacy Flash/PDF cross-domain policy files. Costs one header, closes one door.
  'X-Permitted-Cross-Domain-Policies': 'none',
});

/** Sent only over a real HTTPS connection — see the header comment. */
export const HSTS_HEADER = 'Strict-Transport-Security';
export const HSTS_VALUE = 'max-age=31536000; includeSubDomains';

/**
 * Was this request served over HTTPS?
 *
 * Behind a reverse proxy (TurboOps/Traefik, and `lt dev up`'s Caddy) the connection
 * to Nitro is plain HTTP, and the only truth is `X-Forwarded-Proto`. A direct HTTPS
 * connection has no such header, so both are checked.
 */
export function isSecureRequest(options: { forwardedProto?: string; protocol?: string }): boolean {
  const forwarded = options.forwardedProto?.split(',')[0]?.trim().toLowerCase();
  if (forwarded) {
    return forwarded === 'https';
  }
  return options.protocol?.toLowerCase().replace(':', '') === 'https';
}

/**
 * Build the header set for one response.
 *
 * Returns a new object rather than mutating: unlike the cache-control case, these are
 * applied with `setResponseHeader` per entry rather than merged onto a renderer
 * result, so there is nothing to mutate in place.
 *
 * @param options.secure Whether the request arrived over HTTPS (see `isSecureRequest`).
 */
export function buildSecurityHeaders(options: { secure: boolean }): Record<string, string> {
  const headers: Record<string, string> = { ...ALWAYS };
  if (options.secure) {
    headers[HSTS_HEADER] = HSTS_VALUE;
  }
  return headers;
}
