/**
 * Both UApp roots — app.vue and error.vue — must pass the same `locale` and `toaster`.
 *
 * Nuxt renders error.vue INSTEAD of app.vue, so props set on app.vue's UApp never reach an
 * error page. When app.vue got `:locale="de"`, error.vue kept a bare `<UApp>`, and the 404
 * page read "Back to home" in an otherwise German UI, with the toast region announced in
 * English as well. Nothing fails when that happens; it only shows on a page nobody opens
 * during development.
 *
 * The locale also has to be the site's language: site-locale-contract.test.ts pins
 * `site.defaultLocale` to `<html lang>`, and this closes the chain to Nuxt UI's own texts.
 *
 * Read as text, like the other contract tests: the question is structural.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const ROOTS = ['app/app.vue', 'app/error.vue'] as const;

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

/** The opening `<UApp …>` tag of a root component, or undefined. */
function uAppTag(path: string): string | undefined {
  return /<UApp\b[^>]*>/.exec(read(path))?.[0];
}

/** The identifier bound to `:locale`, e.g. `de`. */
function localeBinding(path: string): string | undefined {
  return /:locale="([^"]+)"/.exec(uAppTag(path) ?? '')?.[1];
}

describe('UApp root contract', () => {
  it.each(ROOTS)('%s binds locale and toaster on its UApp', (path) => {
    const tag = uAppTag(path);
    expect(tag, `${path} renders a UApp`).toBeDefined();
    expect(tag, `${path}: UApp without :locale renders Nuxt UI's texts in English`).toMatch(/:locale="/);
    expect(tag, `${path}: UApp without :toaster falls back to Reka's English toast label`).toMatch(/:toaster="appConfig\.toaster"/);
  });

  it('uses the same locale in both roots', () => {
    expect(localeBinding('app/error.vue')).toBe(localeBinding('app/app.vue'));
  });

  it('imports the locale of the site language from @nuxt/ui/locale', () => {
    const defaultLocale = /\bdefaultLocale:\s*['"]([^'"]+)['"]/.exec(read('nuxt.config.ts'))?.[1];
    for (const path of ROOTS) {
      const binding = localeBinding(path);
      expect(binding, `${path} binds :locale`).toBeDefined();
      expect(read(path), `${path} imports ${binding} from @nuxt/ui/locale`).toMatch(new RegExp(`import \\{ ${binding} \\} from '@nuxt/ui/locale'`));
      expect(binding, `${path}: Nuxt UI locale must match site.defaultLocale`).toBe(defaultLocale);
    }
  });
});
