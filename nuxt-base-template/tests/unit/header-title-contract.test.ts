/**
 * Every `<UHeader>` must bind `:title` to the site name.
 *
 * UHeader builds the aria-label of its home link from the text of the `#title` slot and falls
 * back to its `title` prop, whose default is "Nuxt UI". The default layout fills that slot with
 * an icon only, so the slot has no text, and screen readers announced the logo link as
 * "Nuxt UI" — a name that belongs to the component library, not to the generated project.
 * Nothing fails when that happens; it only shows in the accessibility tree.
 *
 * The title comes from `useSiteConfig().name`, the same source app.vue's titleTemplate renders
 * as `%siteName`, so the tab title and the link name cannot drift apart when a project renames
 * itself in `site.name`.
 *
 * Read as text, like the other contract tests: the question is structural.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return vueFiles(path);
    return entry.name.endsWith('.vue') ? [path] : [];
  });
}

const headers = vueFiles(join(ROOT, 'app')).flatMap((path) =>
  [...readFileSync(path, 'utf8').matchAll(/<UHeader\b[^>]*>/g)].map((match) => ({ file: relative(ROOT, path), tag: match[0] })),
);

describe('UHeader title contract', () => {
  it('finds at least one UHeader', () => {
    expect(headers.length).toBeGreaterThan(0);
  });

  it.each(headers)('$file binds :title to the site name', ({ file, tag }) => {
    expect(tag, `${file}: UHeader without :title names its home link "Nuxt UI" for screen readers`).toMatch(/:title="siteConfig\.name"/);
    expect(readFileSync(join(ROOT, file), 'utf8'), `${file} reads the site name from useSiteConfig()`).toMatch(/const siteConfig = useSiteConfig\(\);/);
  });
});
