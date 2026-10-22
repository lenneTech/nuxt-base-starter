/**
 * nuxt-og-image (pulled in by `@nuxtjs/seo`) is either switched off, or used together with what
 * it needs.
 *
 * Enabled by default, it registers a runtime image renderer under `/_og` and signs its URLs with a
 * secret it generates on every build, warning about that on every `nuxt dev` start. With no page
 * calling `defineOgImage()` the renderer has nothing to render: the module only adds an unused
 * endpoint and a warning people learn to ignore. Every project generated from this template
 * inherited exactly that.
 *
 * So the template ships it disabled, and the contract runs both ways: no OG image in the app means
 * the module is off; switching it on means there is a `defineOgImage*()` call and `.env.example`
 * documents a fixed `NUXT_OG_IMAGE_SECRET` (an auto-generated one breaks signed URLs as soon as two
 * instances or two builds serve the same site).
 *
 * Read as text, like the other contract tests: the question is structural, and importing would
 * execute the whole Nuxt config.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(vue|ts)$/.test(entry.name) ? [path] : [];
  });
}

const config = readFileSync(join(ROOT, 'nuxt.config.ts'), 'utf8').replace(/\/\/.*$/gm, '');
const disabled = /\bogImage:\s*\{[^}]*\benabled:\s*false\b/.test(config);
const usesOgImage = sourceFiles(join(ROOT, 'app')).some((path) => /\bdefineOgImage\w*\s*\(/.test(readFileSync(path, 'utf8')));
const envExample = existsSync(join(ROOT, '.env.example')) ? readFileSync(join(ROOT, '.env.example'), 'utf8') : '';

describe('OG image contract', () => {
  it('disables nuxt-og-image while no page defines an OG image', () => {
    if (usesOgImage) return;
    expect(disabled, 'set `ogImage: { enabled: false }` in nuxt.config.ts — nothing calls defineOgImage()').toBe(true);
  });

  it('documents a fixed signing secret once the module is enabled', () => {
    if (disabled) return;
    expect(usesOgImage, 'nuxt-og-image is enabled but no page calls defineOgImage()').toBe(true);
    expect(envExample, '.env.example must document NUXT_OG_IMAGE_SECRET (npx nuxt-og-image generate-secret)').toMatch(/NUXT_OG_IMAGE_SECRET/);
  });
});
