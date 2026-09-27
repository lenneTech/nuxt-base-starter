/**
 * `site.defaultLocale` must equal `app.head.htmlAttrs.lang` in nuxt.config.ts.
 *
 * nuxt-seo-utils writes the site locale into `<html lang>` (its applyDefaults), so the
 * `lang: 'de'` set under `app.head` never reaches the page on its own: with no
 * `site.defaultLocale` the locale falls back to `en`, and the German UI was served as
 * `<html lang="en">` — screen readers read it with an English voice, and og:locale,
 * canonical casing and Schema.org followed the wrong language. Only the startup warning
 * nuxt-seo-utils 8.5 added made it visible.
 *
 * Read as text rather than by importing the config, like runtime-config-contract.test.ts:
 * the question is structural, and importing would execute the whole Nuxt config.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, '..', '..', 'nuxt.config.ts'), 'utf8');

/** The quoted value of `key:` inside the first `<block>: {` object, or undefined. */
function valueIn(block: string, key: string): string | undefined {
  const start = source.indexOf(`${block}: {`);
  if (start === -1) return undefined;
  let depth = 0;
  let end = start;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  const body = source.slice(start, end).replace(/\/\/.*$/gm, '');
  return new RegExp(`\\b${key}:\\s*['"]([^'"]+)['"]`).exec(body)?.[1];
}

describe('site locale contract', () => {
  it('declares the html lang and a site defaultLocale', () => {
    expect(valueIn('htmlAttrs', 'lang'), 'app.head.htmlAttrs.lang').toBeDefined();
    expect(valueIn('site', 'defaultLocale'), 'site.defaultLocale — without it nuxt-seo-utils renders <html lang="en">').toBeDefined();
  });

  it('uses the same language for both', () => {
    expect(valueIn('site', 'defaultLocale')).toBe(valueIn('htmlAttrs', 'lang'));
  });
});
