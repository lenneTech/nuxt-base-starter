// @vitest-environment node
/**
 * The dev API proxy must not swallow the app's own Nitro routes under `/api`.
 *
 * With `NUXT_PUBLIC_API_PROXY=true` (the `.env.example` default for classic local dev), Vite's
 * `server.proxy` forwards `/api/...` to the backend before Nitro sees the request. A plain
 * `'/api'` key took EVERY path under it, including `server/api/build-identity.get.ts`, so
 * `/app/admin/system` logged a 404 for `/api/build-identity` on every visit and fell back to the
 * bundled commit. Production was unaffected (no Vite proxy there), which is why nothing noticed.
 *
 * `server/api/iam/[...path].ts` is different on purpose: it is the backend pass-through for SSR,
 * so the dev proxy may answer it directly. Every other file under `server/api/` is the app's own
 * route and has to stay with Nitro.
 *
 * Read as text, like the other contract tests: importing would execute the whole Nuxt config.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const config = readFileSync(join(ROOT, 'nuxt.config.ts'), 'utf8').replace(/^\s*\/\/.*$/gm, '');

/** The key of the proxy entry that rewrites `/api` away, as Vite reads it. */
function apiProxyMatcher(): (url: string) => boolean {
  const match = /proxy:\s*\{\s*(['"])(.+?)\1:\s*\{[^}]*rewrite:\s*\(path\)\s*=>\s*path\.replace\(\/\^\\\/api\//s.exec(config);
  if (!match) throw new Error('nuxt.config.ts: no vite.server.proxy entry rewriting /api found');
  const key = match[2].replace(/\\\\/g, '\\');
  // Vite: a key starting with `^` is a RegExp, anything else a path prefix.
  return key.startsWith('^') ? (url) => new RegExp(key).test(url) : (url) => url.startsWith(key);
}

/** The one file under server/api/ that is meant to reach the backend. */
const BACKEND_PASS_THROUGH = 'iam/[...path].ts';

/**
 * A concrete URL for every route file under `server/api/`, derived the way Nitro maps file names
 * (nitropack `scanServerRoutes`): extension, method and env suffix dropped, `(group)/` segments
 * removed, a trailing `/index` collapsed, and dynamic segments filled with sample values. Only the
 * backend pass-through is skipped; an own catch-all such as `cms/[...path].ts` is checked too.
 */
function ownNitroRoutes(): string[] {
  const dir = join(ROOT, 'server', 'api');
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  return walk(dir)
    .map((file) => relative(dir, file).split('\\').join('/'))
    .filter((file) => file !== BACKEND_PASS_THROUGH)
    .map(
      (file) =>
        `/api/${file
          .replace(/\.[A-Za-z]+$/, '')
          .replace(/\([^/]+\)\//g, '')
          .replace(/\[\.{3}\w*]/g, 'a/b')
          .replace(/\[[^/\]]+]/g, 'x')
          .replace(/(\.(connect|delete|get|head|options|patch|post|put|trace))?(\.(dev|prod|prerender))?$/, '')
          .replace(/\/index$/, '')}`,
    );
}

describe('dev API proxy vs. Nitro routes', () => {
  const proxied = apiProxyMatcher();

  it('finds the app routes it protects', () => {
    expect(ownNitroRoutes()).toContain('/api/build-identity');
  });

  it.each(ownNitroRoutes())('leaves %s to Nitro', (route) => {
    expect(proxied(route), `${route} is an app route but the dev proxy forwards it to the backend`).toBe(false);
    expect(proxied(`${route}?x=1`)).toBe(false);
  });

  it.each(['/api/iam/sign-in/email', '/api/i18n/errors/de', '/api/meta', '/api/build-identity-x'])('still forwards backend path %s', (url) => {
    expect(proxied(url)).toBe(true);
  });
});
