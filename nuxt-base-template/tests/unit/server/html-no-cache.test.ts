/**
 * Contract test for the SSR HTML caching plugin.
 *
 * The plugin's failure modes are both silent, which is why it is worth pinning:
 *
 * - Too narrow → it never fires (a `Content-Type` key with different casing, an
 *   absent header bag) and stale post-deploy documents come back without a symptom.
 * - Too broad → it overwrites a project's own `routeRules` caching, disabling CDN
 *   caching of HTML with no error and no warning.
 *
 * `applyHtmlCacheHeaders` is the pure half of the plugin; the Nitro hook is a
 * three-line adapter around it.
 */
import { describe, expect, it } from 'vitest';

import { applyHtmlCacheHeaders } from '../../../server/utils/html-cache-headers';

const html = (extra: Record<string, string> = {}): Record<string, string> => ({ 'content-type': 'text/html;charset=utf-8', ...extra });

describe('applyHtmlCacheHeaders', () => {
  describe('applies to SSR HTML', () => {
    it('sets private, no-cache and Vary: Cookie', () => {
      const headers = html();
      expect(applyHtmlCacheHeaders(headers)).toBe(true);
      expect(headers['cache-control']).toBe('private, no-cache');
      expect(headers.vary).toBe('Cookie');
    });

    it('marks the response private — `no-cache` alone still permits shared storage', () => {
      // Every /app/** page is per-user SSR output carrying the signed-in user's
      // name and e-mail. `no-cache` means "revalidate", not "do not store".
      const headers = html();
      applyHtmlCacheHeaders(headers);
      expect(headers['cache-control']).toContain('private');
    });

    it('appends to an existing Vary instead of replacing it', () => {
      const headers = html({ vary: 'Accept-Encoding' });
      applyHtmlCacheHeaders(headers);
      expect(headers.vary).toBe('Accept-Encoding, Cookie');
    });

    it.each([
      ['lowercase', 'content-type'],
      ['capitalised', 'Content-Type'],
      ['upper', 'CONTENT-TYPE'],
    ])('recognises the %s content-type key', (_label, key) => {
      // The header bag is a plain object, not a normalising `Headers` instance, so
      // a lowercase-only lookup would silently skip the fix.
      const headers = { [key]: 'text/html;charset=utf-8' };
      expect(applyHtmlCacheHeaders(headers)).toBe(true);
      expect(headers['cache-control']).toBe('private, no-cache');
    });
  });

  describe('leaves everything else alone', () => {
    it.each([
      ['JSON', { 'content-type': 'application/json' }],
      ['JS payload', { 'content-type': 'text/javascript' }],
      ['no content-type at all', {}],
      ['empty content-type', { 'content-type': '' }],
    ])('%s', (_label, headers: Record<string, string>) => {
      expect(applyHtmlCacheHeaders(headers)).toBe(false);
      expect(headers['cache-control']).toBeUndefined();
      expect(headers.vary).toBeUndefined();
    });
  });

  describe('never overrules an explicit caching decision', () => {
    it('bails out when routeRules set cache-control', () => {
      // The regression this guards: a project adds `routeRules: { '/**': { swr: 600 } }`
      // and CDN caching of HTML silently stops working, because routeRules headers
      // are applied BEFORE the handler and this hook writes AFTER it.
      const headers = html();
      expect(applyHtmlCacheHeaders(headers, 'public, max-age=600, s-maxage=600')).toBe(false);
      expect(headers['cache-control']).toBeUndefined();
    });

    it('bails out when the response already carries cache-control', () => {
      const headers = html({ 'cache-control': 'public, max-age=60' });
      expect(applyHtmlCacheHeaders(headers)).toBe(false);
      expect(headers['cache-control']).toBe('public, max-age=60');
    });

    it('recognises an existing cache-control regardless of key casing', () => {
      const headers: Record<string, string> = { 'Cache-Control': 'public, max-age=60', 'content-type': 'text/html' };
      expect(applyHtmlCacheHeaders(headers)).toBe(false);
      expect(headers['cache-control']).toBeUndefined();
    });
  });

  it('is idempotent — a second pass changes nothing', () => {
    // The hook can only fire once per response today, but an idempotent function
    // cannot produce `Cookie, Cookie` if that ever stops being true.
    const headers = html();
    applyHtmlCacheHeaders(headers);
    const afterFirst = { ...headers };
    expect(applyHtmlCacheHeaders(headers)).toBe(false);
    expect(headers).toEqual(afterFirst);
  });
});
