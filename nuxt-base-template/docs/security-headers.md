# Security headers

What this template sends, what it deliberately does not, and how to add the rest.

## What is sent, and from where

`server/plugins/security-headers.ts` sets them on `beforeResponse`, so they cover SSR
pages, `/api/**` routes and error responses alike. The decision lives in
`server/utils/security-headers.ts` and is unit-tested in
`tests/unit/server/security-headers.test.ts`.

| Header                              | Value                                                  | Sent           |
| ----------------------------------- | ------------------------------------------------------ | -------------- |
| `X-Content-Type-Options`            | `nosniff`                                              | always         |
| `X-Frame-Options`                   | `DENY`                                                 | always         |
| `Referrer-Policy`                   | `strict-origin-when-cross-origin`                      | always         |
| `Permissions-Policy`                | `camera=(), microphone=(), geolocation=(), payment=()` | always         |
| `X-DNS-Prefetch-Control`            | `off`                                                  | always         |
| `X-Permitted-Cross-Domain-Policies` | `none`                                                 | always         |
| `Strict-Transport-Security`         | `max-age=31536000; includeSubDomains`                  | **HTTPS only** |
| `x-powered-by`                      | _(removed)_                                            | always         |

A header a route already set is never overwritten, so a project that needs to be
framed can say so in its own route rule without fighting the plugin.

## Why HSTS is conditional

`Strict-Transport-Security` tells a browser to refuse plain HTTP for a host, and
browsers **remember** it. Sent once from a dev server on `localhost`, it can make
every other local project on `http://localhost` unreachable in that browser — for a
year, with no obvious way back.

So it is sent only when the request actually arrived over HTTPS, decided from
`X-Forwarded-Proto` (behind TurboOps/Traefik and `lt dev up`'s Caddy the connection to
Nitro is plain HTTP, so the header is the only truth) with the connection protocol as
fallback. It is never inferred from an env var — a misconfigured env is exactly the
case that would poison a developer's browser.

## Why there is no Content-Security-Policy

Not an oversight. A CSP is the one header in this family that breaks a working app
when it is wrong, and a correct one depends on what the project actually loads: fonts,
analytics, an embedded map, a payment iframe, a rich-text editor. A template cannot
know that. A CSP shipped "to be safe" would either be permissive enough to protect
nothing, or break the first project that adds a third-party script — and it would
break it in production, because that is where the third-party script is.

**Add one per project**, and test it. A workable order:

1. Start in report-only. `Content-Security-Policy-Report-Only` sends violations
   without enforcing, so a wrong policy costs a log entry rather than a white page.
2. Collect real violations from real pages, including the ones only an admin sees.
3. Tighten to enforcing once the report is quiet.

Nuxt-specific traps worth knowing before you start: SSR hydration and Nuxt UI emit
inline styles (so `style-src` needs `'unsafe-inline'` or a nonce), the icon set fetches
from its own origin, and `@nuxtjs/seo`'s OG image rendering runs at build time and does
not appear in browser reports at all.

The API side of a fullstack project is separate and has its own answer — see
`projects/api/src/main.ts` in projects that already ship one (svl, volksbank/imo hand-roll
the equivalent set there, including a nonce-based CSP for Swagger UI).

## Changing them

Override per route where a project genuinely differs:

```ts
// nuxt.config.ts
routeRules: {
  '/embed/**': { headers: { 'X-Frame-Options': 'SAMEORIGIN' } },
},
```

The plugin only fills in a header that is not already set, so a route rule wins.