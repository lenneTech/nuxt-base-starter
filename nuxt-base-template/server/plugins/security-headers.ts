/**
 * Send security headers on every response.
 *
 * The decision — which headers, and why HSTS is conditional — lives in
 * `server/utils/security-headers.ts`, where it is unit-testable. This file is only
 * the wiring.
 *
 * Hooked on `beforeResponse` rather than `render:response`: the latter fires only for
 * SSR page renders, which would leave every `/api/**` route and every error response
 * bare. `beforeResponse` covers all of them.
 *
 * `x-powered-by` is removed here too. It names the framework and version to anyone
 * scanning, and buys nothing.
 */
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('beforeResponse', (event) => {
    const secure = isSecureRequest({
      forwardedProto: getRequestHeader(event, 'x-forwarded-proto'),
      protocol: getRequestProtocol(event),
    });

    for (const [name, value] of Object.entries(buildSecurityHeaders({ secure }))) {
      // Never overwrite a header a route set deliberately — a project that needs to
      // be framed sets `X-Frame-Options` in its own route rule, and this must not
      // undo that decision.
      if (!getResponseHeader(event, name)) {
        setResponseHeader(event, name, value);
      }
    }

    removeResponseHeader(event, 'x-powered-by');
  });
});
