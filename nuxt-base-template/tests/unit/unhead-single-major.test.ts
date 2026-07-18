/**
 * Guards the "exactly ONE unhead major" invariant.
 *
 * Background: nuxt 4.4.x is built against unhead v2, while parts of the SEO
 * chain (nuxt-seo-utils >= 8.1.10 via @unhead/bundler, nuxt-schema-org peer
 * resolution) pull unhead v3. With TWO unhead majors in the tree, Nitro's
 * externals tracer copies a PARTIAL unhead v3 into
 * `.output/server/node_modules/unhead` (missing dist/server.mjs) and every
 * SSR request of the BUILT app dies with 500 ERR_MODULE_NOT_FOUND — dev mode
 * is unaffected, so unit tests and `nuxt dev` stay green while production
 * breaks. The pnpm-workspace.yaml overrides (`nuxt-seo-utils`, `unhead`) pin
 * the tree to v2; this test makes sure no future dependency bump silently
 * reintroduces the split.
 *
 * Layout-agnostic: in the standalone starter the lockfile sits next to this
 * template; in an lt fullstack monorepo the single lockfile lives at the
 * workspace root (`projects/app/` has none) — so walk up to the nearest
 * pnpm-lock.yaml.
 *
 * Remove this guard only when nuxt itself moves to unhead v3 AND the
 * overrides are dropped — then re-point the expectation to the new major.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const templateRoot = join(import.meta.dirname, '..', '..');

function findLockfile(start: string): null | string {
  let dir = start;
  for (let i = 0; i < 7; i++) {
    const candidate = join(dir, 'pnpm-lock.yaml');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
  return null;
}

describe('unhead — single major version', () => {
  const lockfilePath = findLockfile(templateRoot);

  it('finds a pnpm lockfile (template root or workspace root)', () => {
    expect(lockfilePath).not.toBeNull();
  });

  it('resolves exactly one unhead major in the lockfile', () => {
    const lockfile = readFileSync(lockfilePath as string, 'utf8');
    // Match resolved package entries like `unhead@2.1.15` (with or without
    // quotes/leading slash), NOT scoped packages like `@unhead/vue@…`.
    const majors = new Set([...lockfile.matchAll(/[^@/\w]unhead@(\d+)\./g)].map((m) => m[1]));
    expect(majors.size, `unhead majors found: ${[...majors].join(', ') || 'none'}`).toBe(1);
  });
});
