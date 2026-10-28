/**
 * `@nuxtjs/seo` 6 (nuxt-seo-utils 9) runs unhead's `ValidatePlugin` in the browser during `nuxt dev`.
 * On the template it printed three warnings on every page without its own description, which is
 * 20 of 21 pages, in every generated project (measured 2026-10-28):
 *
 * - `twitter:card is deprecated`: unhead's own `InferSeoMetaPlugin` adds `twitter:card` and its
 *   own validator flags it (unjs/unhead#842). Upstream's switch for exactly this is
 *   `seo.automaticTwitterTags: false` (nuxt-seo-utils#140): Open Graph inference stays, X renders
 *   cards from Open Graph.
 * - `og:description has empty content` and `missing a meta description and is indexable`: the
 *   inferred `og:description` is `''` without a description, and the validator runs before empty
 *   tags are dropped. "Indexable" is a false positive on `noindex` pages, because
 *   `@nuxtjs/robots` adds its meta tag on the server only and the validator checks the client
 *   head. A `site.description` fallback (low priority, every page's own `useSeoMeta` wins) ends
 *   both, and gives link previews and Schema.org a description.
 *
 * The fallback would also silence the warning on a PUBLIC page that forgot its own description,
 * so the third check takes over that job: every page outside the `robots: false` prefixes sets
 * its own description. Turning validation off instead would have dropped every real check too
 * (relative og:url, canonical conflicts, unresolved `%` placeholders).
 *
 * Read as text, like the other contract tests: importing would execute the whole Nuxt config.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const PAGES = join(ROOT, 'app', 'pages');
const config = readFileSync(join(ROOT, 'nuxt.config.ts'), 'utf8').replace(/^\s*\/\/.*$/gm, '');

/** Body of a top-level object key of `defineNuxtConfig({ ... })`, or undefined. */
function topLevel(key: string): string | undefined {
  const match = new RegExp(`^ {2}${key}:\\s*\\{`, 'm').exec(config);
  if (!match) return undefined;
  let depth = 0;
  const start = match.index + match[0].length - 1;
  for (let i = start; i < config.length; i++) {
    if (config[i] === '{') depth++;
    if (config[i] === '}' && --depth === 0) return config.slice(start, i + 1);
  }
  return undefined;
}

/** Route prefixes the config marks `robots: false`, e.g. `/auth/` from `'/auth/**': { robots: false }`. */
function noindexPrefixes(): string[] {
  return [...(topLevel('routeRules') ?? '').matchAll(/'(\/[^']*?)\*\*':\s*\{[^}]*robots:\s*false/g)].map((match) => match[1]);
}

function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pageFiles(path);
    return entry.name.endsWith('.vue') ? [path] : [];
  });
}

/** `app/pages/foo/index.vue` → `/foo/`, `app/pages/index.vue` → `/`. */
function routeOf(file: string): string {
  const route = `/${relative(PAGES, file)
    .replace(/\.vue$/, '')
    .replace(/(^|\/)index$/, '$1')}`;
  return route.endsWith('/') ? route : `${route}/`;
}

function setsOwnDescription(source: string): boolean {
  return /useSeoMeta\(\{[\s\S]*?\bdescription\b/.test(source) || /useHead\(\{[\s\S]*?name:\s*'description'/.test(source);
}

describe('SEO dev console contract', () => {
  it('turns off the twitter:card that unhead itself flags as deprecated', () => {
    expect(topLevel('seo'), 'set `seo: { automaticTwitterTags: false }` in nuxt.config.ts').toMatch(/automaticTwitterTags:\s*false/);
  });

  it('gives the site a description fallback', () => {
    expect(topLevel('site'), 'set a non-empty `site.description` in nuxt.config.ts').toMatch(/description:\s*'[^']+'/);
  });

  it('reads the noindex prefixes from the route rules', () => {
    // Without this, a renamed key would empty the list and declare every page public.
    expect(noindexPrefixes()).toEqual(expect.arrayContaining(['/app/', '/auth/']));
  });

  it('can tell a page with its own description from one without', () => {
    expect(setsOwnDescription(readFileSync(join(PAGES, 'index.vue'), 'utf8'))).toBe(true);
    expect(setsOwnDescription(readFileSync(join(PAGES, 'auth', 'login.vue'), 'utf8'))).toBe(false);
  });

  it('has every public page set its own description', () => {
    const prefixes = noindexPrefixes();
    const publicPages = pageFiles(PAGES).filter((file) => !prefixes.some((prefix) => routeOf(file).startsWith(prefix)));
    expect(publicPages.length, 'found no public page at all').toBeGreaterThan(0);
    const missing = publicPages.filter((file) => !setsOwnDescription(readFileSync(file, 'utf8'))).map((file) => relative(ROOT, file));
    expect(missing, 'public pages fall back to the shared site.description; give each its own useSeoMeta({ description })').toEqual([]);
  });
});
