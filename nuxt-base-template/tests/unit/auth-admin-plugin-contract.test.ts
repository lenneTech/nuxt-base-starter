// @vitest-environment node
/**
 * The auth client loads no Better Auth admin plugin.
 *
 * `ltExtensions.auth.enableAdmin` adds Better Auth's admin client plugin (`admin.createUser`,
 * `admin.setUserPassword`, …). nest-server registers no `admin()` plugin, so every one of these
 * calls answers 404, and `/iam/features` reports no admin feature. nuxt-extensions 4.0.0 defaults
 * the option to `false`; up to 1.28.0 the default was `true`, so a project on an older (or vendored
 * older) core keeps the plugin without the key. The config says `false` either way. The admin area
 * of the template goes by the user's role (`isAdminUser`), which this option does not touch;
 * `tests/e2e/auth-admin-role.spec.ts` walks it against a real API.
 *
 * A project whose API registers `admin()` itself sets the option to `true` and changes this test.
 *
 * Read as text, like the other config contracts: the question is which value the file sets.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const config = readFileSync(join(ROOT, 'nuxt.config.ts'), 'utf8').replace(/^\s*\/\/.*$/gm, '');

describe('Better Auth admin plugin', () => {
  it('is switched off explicitly, once', () => {
    expect([...config.matchAll(/\benableAdmin\s*:\s*([^,\n}]+)/g)].map((match) => match[1]?.trim())).toEqual(['false']);
  });
});
