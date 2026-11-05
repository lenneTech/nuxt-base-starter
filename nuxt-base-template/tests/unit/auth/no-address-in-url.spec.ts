/**
 * No page puts an e-mail address into a URL it navigates to.
 *
 * Login and sign-up sent visitors to `/auth/verify-email?email=…`. From the address bar the address
 * went to analytics, into the referrer of links, into the browser history and into every link
 * somebody pasted while asking for help. They hand it over in the history entry now
 * (`verifyEmailState`, `app/utils/verify-email-memory.ts`); this keeps a new page from bringing the
 * query back. A structural check, so it reads the sources: the flow itself is
 * `tests/e2e/auth-verify-email-url.spec.ts`, which needs a real API.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const projectRoot = join(import.meta.dirname, '..', '..', '..');

/** `pages/` under the source directory: `app/` since Nuxt 4, `src/` or the root in older layouts. */
const pagesDir = ['app', 'src', '.'].map((dir) => join(projectRoot, dir, 'pages')).find((dir) => existsSync(dir)) ?? join(projectRoot, 'app', 'pages');

const pages = readdirSync(pagesDir, { recursive: true })
  .map(String)
  .filter((file) => file.endsWith('.vue'));

/** A `query: { … }` object literal that names an e-mail field, as key or as shorthand. */
const ADDRESS_IN_QUERY = /query:\s*\{[^}]*\bemail\b/;

it('finds the pages it checks', () => {
  expect(pages.length).toBeGreaterThan(0);
});

it.each(pages)('%s puts no e-mail address into a query', (file) => {
  expect(readFileSync(join(pagesDir, file), 'utf8')).not.toMatch(ADDRESS_IN_QUERY);
});
