/**
 * Contract test for the security headers.
 *
 * Two failure modes, and the dangerous one is not the obvious one:
 *
 * - Too narrow → a header silently stops being sent. Nothing breaks, nothing warns,
 *   and the protection is simply gone in every project generated from the template.
 * - Too broad → `Strict-Transport-Security` escapes onto a plain-HTTP dev server.
 *   Browsers REMEMBER HSTS, so that one mistake can make every other project on
 *   `http://localhost` unreachable in that browser for a year. This is the reason
 *   `isSecureRequest` exists at all, and why it is pinned from both sides here.
 *
 * `buildSecurityHeaders` / `isSecureRequest` are the pure half; the Nitro plugin is
 * the adapter around them.
 */
import { describe, expect, it } from 'vitest';

import { buildSecurityHeaders, HSTS_HEADER, isSecureRequest } from '../../../server/utils/security-headers';

describe('isSecureRequest', () => {
  it('trusts x-forwarded-proto, because behind a proxy it is the only truth', () => {
    // TurboOps/Traefik and `lt dev up`'s Caddy both terminate TLS and speak plain
    // HTTP to Nitro. Without this the deployed app would never send HSTS.
    expect(isSecureRequest({ forwardedProto: 'https', protocol: 'http' })).toBe(true);
  });

  it('reads only the FIRST value of a proxy chain', () => {
    // A chained proxy appends: `https, http`. The first hop is the one that faced
    // the browser, and it is the one that decides.
    expect(isSecureRequest({ forwardedProto: 'https, http' })).toBe(true);
    expect(isSecureRequest({ forwardedProto: 'http, https' })).toBe(false);
  });

  it('falls back to the connection protocol when no proxy header is present', () => {
    expect(isSecureRequest({ protocol: 'https' })).toBe(true);
    expect(isSecureRequest({ protocol: 'https:' })).toBe(true);
    expect(isSecureRequest({ protocol: 'http' })).toBe(false);
  });

  it('says NO when it cannot tell', () => {
    // The asymmetry is deliberate: a missing HSTS header costs a little protection
    // on one response, while a wrongly sent one can lock a developer out of
    // http://localhost for a year.
    expect(isSecureRequest({})).toBe(false);
    expect(isSecureRequest({ forwardedProto: '', protocol: '' })).toBe(false);
  });
});

describe('buildSecurityHeaders', () => {
  it('sends the protections that cannot break a correct app, on every response', () => {
    const headers = buildSecurityHeaders({ secure: false });

    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toContain('camera=()');
    expect(headers['X-DNS-Prefetch-Control']).toBe('off');
    expect(headers['X-Permitted-Cross-Domain-Policies']).toBe('none');
  });

  it('NEVER sends HSTS over plain HTTP — the one that is hard to undo', () => {
    expect(buildSecurityHeaders({ secure: false })).not.toHaveProperty(HSTS_HEADER);
  });

  it('sends HSTS over HTTPS', () => {
    expect(buildSecurityHeaders({ secure: true })[HSTS_HEADER]).toBe('max-age=31536000; includeSubDomains');
  });

  it('ships no Content-Security-Policy', () => {
    // Deliberate, not forgotten. A correct CSP depends on what a project loads —
    // fonts, analytics, an embedded map — and a template cannot know that. One
    // shipped "to be safe" is either permissive enough to protect nothing, or it
    // breaks the first project that adds a third-party script. See
    // docs/security-headers.md.
    expect(buildSecurityHeaders({ secure: true })).not.toHaveProperty('Content-Security-Policy');
  });

  it('returns a fresh object, so one response cannot leak a header into the next', () => {
    const first = buildSecurityHeaders({ secure: true });
    first['X-Frame-Options'] = 'SAMEORIGIN';
    expect(buildSecurityHeaders({ secure: false })['X-Frame-Options']).toBe('DENY');
  });
});
