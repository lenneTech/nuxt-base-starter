/**
 * The project's name and repository link live in one file, `app/utils/site.ts`.
 *
 * `lt fullstack init` (and `lt frontend nuxt`) rewrites exactly two lines there: `SITE_NAME` becomes
 * the project name and `SITE_REPO_URL` becomes `null`, which hides every GitHub link. Before that
 * file existed, every generated project showed "Nuxt Base Starter" in its title and header and
 * linked to the starter's repository. The CLI edits the two lines as text, with the same pattern it
 * uses for ng-base-starter's `src/app/shared/site.ts`, so they stay single-line literals of exactly
 * this form: a reformatted declaration would leave the starter's name and link in every project.
 *
 * Read as text, like the other contract tests: the question is what the CLI finds in the file.
 * `site-repo-link.test.ts` renders the links with and without a repository.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const APP = join(ROOT, 'app');
/**
 * Vendor mode: nuxt-extensions copied as it is tagged. Its source names the starter's repository in a
 * comment (`runtime/lib/auth-state.ts`, `@see …/nuxt-base-starter`), and it is not the project's code.
 */
const VENDORED_CORE = join(APP, 'core') + sep;
const SITE_FILE = join(APP, 'utils', 'site.ts');
const SITE = readFileSync(SITE_FILE, 'utf8');
const NUXT_CONFIG = readFileSync(join(ROOT, 'nuxt.config.ts'), 'utf8');

/** One string literal on one line, single- or double-quoted, escapes included (the CLI's own pattern, plus oxfmt's form). */
const SITE_NAME_LINE = /^export const SITE_NAME = (?:'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*");$/m;
const SITE_REPO_URL_LINE = /^export const SITE_REPO_URL: null \| string = (?:'(?:[^'\\\n]|\\.)*'|null);$/m;

/** The project's own sources under app/: `.ts` and `.vue`, without the vendored core. */
function isProjectSource(file: string): boolean {
  return /\.(?:ts|vue)$/.test(file) && !file.startsWith(VENDORED_CORE);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter(isProjectSource);
}

describe('app/utils/site.ts (the lines the CLI rewrites)', () => {
  it('declares SITE_NAME as a single-line string literal', () => {
    expect(SITE).toMatch(SITE_NAME_LINE);
  });

  it('accepts every SITE_NAME line the CLI and oxfmt write, and nothing spread over lines (self-test)', () => {
    // The CLI escapes a quote in the project name (`'Kai\'s Shop'`); `pnpm run check` formats it to `"Kai's Shop"`.
    for (const name of [`'Nuxt Base Starter'`, String.raw`'Kai\'s Shop'`, `"Kai's Shop"`, String.raw`'C:\\Projekte'`]) {
      expect(`export const SITE_NAME = ${name};`, name).toMatch(SITE_NAME_LINE);
    }
    for (const declaration of ["\n  'Nuxt Base Starter'", '`Nuxt Base Starter`', "'Nuxt' + ' Base Starter'"]) {
      expect(`export const SITE_NAME =${declaration.startsWith('\n') ? '' : ' '}${declaration};`, declaration).not.toMatch(SITE_NAME_LINE);
    }
  });

  it('declares SITE_REPO_URL as a single-line string literal or null', () => {
    expect(SITE).toMatch(SITE_REPO_URL_LINE);
    // The CLI writes exactly this line into a generated project.
    expect('export const SITE_REPO_URL: null | string = null;').toMatch(SITE_REPO_URL_LINE);
  });

  it('leaves the vendored core out of that search and keeps every other source in it (self-test)', () => {
    // The starter has no app/core/; a vendor-mode project has, and this test runs there too.
    expect(isProjectSource(join(APP, 'core', 'runtime', 'lib', 'auth-state.ts'))).toBe(false);
    expect(isProjectSource(join(APP, 'core', 'module.ts'))).toBe(false);
    expect(isProjectSource(join(APP, 'layouts', 'default.vue'))).toBe(true);
    expect(isProjectSource(join(APP, 'utils', 'core-helpers.ts'))).toBe(true);
    expect(isProjectSource(join(APP, 'corepack.ts'))).toBe(true);
    expect(isProjectSource(join(APP, 'assets', 'logo.svg'))).toBe(false);
  });

  it('is the only place under app/ and in nuxt.config.ts that names the starter repository', () => {
    // A link anywhere else would survive the CLI's rewrite. In a generated project site.ts no longer names it either.
    const others = [...sourceFiles(APP).filter((file) => file !== SITE_FILE), join(ROOT, 'nuxt.config.ts')]
      .filter((file) => readFileSync(file, 'utf8').includes('github.com/lenneTech/nuxt-base-starter'))
      .map((file) => relative(ROOT, file));
    expect(others).toEqual([]);
  });

  it('gives nuxt.config.ts the site name for the default title and the site config', () => {
    // `site.name` feeds app.vue's titleTemplate (`%siteName`) and the header's `:title="siteConfig.name"`.
    expect(NUXT_CONFIG).toMatch(/^import \{ SITE_NAME \} from '\.\/app\/utils\/site';$/m);
    expect(NUXT_CONFIG).toMatch(/^\s+title: SITE_NAME,$/m);
    expect(NUXT_CONFIG).toMatch(/^\s+name: SITE_NAME,$/m);
    expect(NUXT_CONFIG).not.toContain("'Nuxt Base Starter'");
  });
});
