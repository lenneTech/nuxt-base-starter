/**
 * Build-identity fallback.
 *
 * `/app/admin/system` compares the App commit against the API's `GET /meta` to
 * spot a partial rollout. That comparison was dead on arrival in production:
 * TurboOps exports every key it knows from the Nuxt runtime config as a
 * container env var, and the ones it has no stage value for arrive as an EMPTY
 * string. Nitro applies that empty value over `runtimeConfig.public.appCommit`,
 * so a container built from commit abc123 reported "unbekannt" — indistinguishable
 * from a stale one.
 *
 * These cases pin the rule that restores it: an empty (or `unknown`) public
 * value falls back to `APP_VERSION_COMMIT`, the prefix-free variable the
 * platform does not manage — while a real public value always wins, so setups
 * where the normal mechanism works keep behaving exactly as before.
 */

import { describe, expect, it } from 'vitest';

import { resolveBuildCommit } from '../../../server/utils/build-commit';

const COMMIT = '9d10d2c629e4d2499fd407cad79eeb4e0edd2165';
const OTHER = '666cfba5e616ac83f23fff81b8447263ef8711c5';

describe('resolveBuildCommit', () => {
  it('keeps the public value when the platform left it intact', () => {
    expect(resolveBuildCommit(COMMIT, OTHER)).toBe(COMMIT);
  });

  it('falls back to APP_VERSION_COMMIT when the platform blanked the public value', () => {
    expect(resolveBuildCommit('', COMMIT)).toBe(COMMIT);
  });

  it('treats a whitespace-only value as blank', () => {
    expect(resolveBuildCommit('   ', COMMIT)).toBe(COMMIT);
  });

  it('treats the "unknown" placeholder as blank', () => {
    expect(resolveBuildCommit('unknown', COMMIT)).toBe(COMMIT);
  });

  it('falls back when the key is missing entirely', () => {
    expect(resolveBuildCommit(undefined, COMMIT)).toBe(COMMIT);
  });

  it('reports "unknown" when neither source carries a commit — a local build', () => {
    expect(resolveBuildCommit('', undefined)).toBe('unknown');
    expect(resolveBuildCommit('unknown', '')).toBe('unknown');
  });

  it('never returns a non-string, whatever the config holds', () => {
    expect(resolveBuildCommit(42, undefined)).toBe('unknown');
    expect(resolveBuildCommit(null, COMMIT)).toBe(COMMIT);
  });
});
