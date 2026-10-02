/**
 * `scripts/check-suppressions.mjs` — every `auditConfig.ignoreGhsas` entry is re-checked against
 * the GitHub Advisory Database and the lockfile, so a suppression cannot outlive its reason. pnpm
 * drops suppressed advisories from `pnpm audit --json`, so without this nothing ever says so.
 *
 * Network access is injected or avoided, so every case runs offline. The advisory shapes are the
 * REST API's (`GET /advisories/{ghsa_id}`): `withdrawn_at`, and `vulnerabilities[]` with
 * `package.{ ecosystem, name }`, `vulnerable_version_range` and `first_patched_version` as a
 * string or null. The node-forge advisory GHSA-86w9-cpqp-85rv returned exactly that on
 * 2026-10-02, with `first_patched_version: null`, while `pnpm audit` named ">=1.4.1" and the
 * registry answered 404 for 1.4.1.
 *
 * Nothing here reads outside the template: these tests ship into generated projects.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { parseSuppressionSummary } from '../../scripts/check.mjs';
import {
  assessSuppression,
  createAdvisoryFetcher,
  createNpmVersionProbe,
  exitCodeFor,
  findWorkspaceRoot,
  inVulnerableRange,
  listSuppressions,
  patchedVersionOf,
  resolvedVersions,
  run,
  summaryLine,
} from '../../scripts/check-suppressions.mjs';
import type { SuppressionResult, SuppressionStatus } from '../../scripts/check-suppressions.mjs';

const ID = 'GHSA-86w9-cpqp-85rv';
const TEMPLATE = join(import.meta.dirname, '..', '..');

function npm(name: string, firstPatched: unknown, range = '<= 1.4.0') {
  return { first_patched_version: firstPatched, package: { ecosystem: 'npm', name }, vulnerable_version_range: range };
}

function deps({ advisory, fetchFails, locked = ['1.4.0'], published = false }: { advisory?: unknown; fetchFails?: string; locked?: string[] | null; published?: boolean | null }) {
  return {
    fetchAdvisory: vi.fn(async () => (fetchFails ? { ok: false as const, reason: fetchFails } : { advisory, ok: true as const })),
    lockedVersions: vi.fn(() => locked),
    npmHasVersion: vi.fn(async () => published),
  };
}

const result = (status: SuppressionStatus): SuppressionResult => ({ detail: '', id: ID, status });

describe('assessSuppression', () => {
  it('still holds while no patched version is named', async () => {
    expect((await assessSuppression(ID, deps({ advisory: { vulnerabilities: [npm('node-forge', null)], withdrawn_at: null } }))).status).toBe('unfixable');
  });

  it('still holds while the named fix is not on the registry (the node-forge 1.4.1 case)', async () => {
    const d = deps({ advisory: { vulnerabilities: [npm('node-forge', '1.4.1')] }, published: false });
    expect((await assessSuppression(ID, d)).status).toBe('fix-unpublished');
    expect(d.npmHasVersion).toHaveBeenCalledWith('node-forge', '1.4.1');
  });

  it('fails once the named fix is published', async () => {
    expect((await assessSuppression(ID, deps({ advisory: { vulnerabilities: [npm('node-forge', '1.4.1')] }, published: true }))).status).toBe('fix-available');
  });

  it('fails when the advisory was withdrawn', async () => {
    expect((await assessSuppression(ID, deps({ advisory: { vulnerabilities: [npm('node-forge', null)], withdrawn_at: '2026-11-01T00:00:00Z' } }))).status).toBe('withdrawn');
  });

  it('fails when the package no longer resolves in the vulnerable range (the image-size case)', async () => {
    const r = await assessSuppression(ID, deps({ advisory: { vulnerabilities: [npm('node-forge', null)] }, locked: ['1.5.0'] }));
    expect(r).toMatchObject({ detail: expect.stringContaining('node-forge@1.5.0'), status: 'not-present' });
    expect((await assessSuppression(ID, deps({ advisory: { vulnerabilities: [npm('node-forge', null)] }, locked: [] }))).status).toBe('not-present');
  });

  it('is unverified — never "still holds" — when it cannot look', async () => {
    expect((await assessSuppression(ID, deps({ fetchFails: 'GitHub Advisory API unreachable (ENOTFOUND)' }))).status).toBe('unverified');
    expect((await assessSuppression(ID, deps({ advisory: { vulnerabilities: [npm('node-forge', null)] }, locked: null }))).status).toBe('unverified');
    expect((await assessSuppression(ID, deps({ advisory: { vulnerabilities: [npm('node-forge', null, 'some day')] } }))).status).toBe('unverified');
    expect((await assessSuppression(ID, deps({ advisory: { vulnerabilities: [npm('node-forge', '1.4.1')] }, published: null }))).status).toBe('unverified');
  });

  it('ignores other ecosystems, and is unverified when no npm package is named', async () => {
    const pip = { first_patched_version: '9.9.9', package: { ecosystem: 'pip', name: 'forge' }, vulnerable_version_range: '< 9.9.9' };
    const d = deps({ advisory: { vulnerabilities: [pip, npm('node-forge', null)] }, published: true });
    expect((await assessSuppression(ID, d)).status).toBe('unfixable');
    expect(d.npmHasVersion).not.toHaveBeenCalled();
    expect((await assessSuppression(ID, deps({ advisory: { vulnerabilities: [pip] } }))).status).toBe('unverified');
  });
});

describe('exitCodeFor', () => {
  it('fails an obsolete entry everywhere', () => {
    for (const status of ['fix-available', 'not-present', 'withdrawn'] as const) {
      expect(exitCodeFor([result('unfixable'), result(status)], { ci: false, token: false })).toBe(1);
      expect(exitCodeFor([result(status)], { ci: true, token: false })).toBe(1);
    }
  });

  it('fails an unverified entry only in CI with a token, where the lookup should have worked', () => {
    expect(exitCodeFor([result('unverified')], { ci: true, token: true })).toBe(1);
    // GitLab runners share one IP across every project: without a token, rate limits are expected.
    expect(exitCodeFor([result('unverified')], { ci: true, token: false })).toBe(0);
    expect(exitCodeFor([result('unverified')], { ci: false, token: true })).toBe(0);
  });

  it('passes entries that still hold', () => {
    expect(exitCodeFor([result('unfixable'), result('fix-unpublished')], { ci: true, token: true })).toBe(0);
  });
});

describe('summary line: producer (check-suppressions.mjs) and reader (check.mjs) agree', () => {
  it('round-trips every state', () => {
    expect(parseSuppressionSummary(summaryLine([]))).toEqual({ count: 0, state: 'none', total: 0 });
    expect(parseSuppressionSummary(summaryLine([result('unfixable'), result('fix-unpublished')]))).toEqual({ count: 2, state: 'verified', total: 2 });
    expect(parseSuppressionSummary(summaryLine([result('unfixable'), result('unverified')]))).toEqual({ count: 1, state: 'unverified', total: 2 });
    expect(parseSuppressionSummary(summaryLine([result('unverified'), result('not-present')]))).toEqual({ count: 1, state: 'obsolete', total: 2 });
  });

  it('reads nothing as verified when the line is missing, and survives colour', () => {
    expect(parseSuppressionSummary('Error: something else entirely')).toBeNull();
    expect(parseSuppressionSummary('\x1b[2m[suppressions] verified 1 of 1\x1b[22m')).toEqual({ count: 1, state: 'verified', total: 1 });
  });
});

describe('lockfile and range reading', () => {
  const LOCK = [
    'packages:',
    '',
    '  node-forge@1.4.0:',
    "  '@nuxt/kit@4.5.2':",
    '  /left-pad@1.3.0:',
    '',
    'snapshots:',
    '',
    "  '@nuxt/kit@4.5.2(magic-string@1.4.2)':",
    '  node-forge-extra@9.9.9: {}',
    '    node-forge: 1.4.0',
  ].join('\n');

  it('reads every version of the named package, and only of that package', () => {
    expect(resolvedVersions(LOCK, 'node-forge')).toEqual(['1.4.0']);
    expect(resolvedVersions(LOCK, '@nuxt/kit')).toEqual(['4.5.2']);
    expect(resolvedVersions(LOCK, 'left-pad')).toEqual(['1.3.0']);
    expect(resolvedVersions(LOCK, 'absent')).toEqual([]);
  });

  it("finds node-forge 1.4.0 in the template's real lockfile", () => {
    expect(resolvedVersions(readFileSync(join(TEMPLATE, 'pnpm-lock.yaml'), 'utf8'), 'node-forge')).toContain('1.4.0');
  });

  it('honours every operator at its boundary, and says when it cannot tell', () => {
    expect(inVulnerableRange('1.4.0', '<= 1.4.0')).toBe(true);
    expect(inVulnerableRange('1.4.1', '<= 1.4.0')).toBe(false);
    expect(inVulnerableRange('1.4.0', '< 1.4.0')).toBe(false);
    expect(inVulnerableRange('2.1.3', '>= 2.0.0, < 2.1.4')).toBe(true);
    expect(inVulnerableRange('2.1.4', '>= 2.0.0, < 2.1.4')).toBe(false);
    expect(inVulnerableRange('1.2.3', '= 1.2.3')).toBe(true);
    expect(inVulnerableRange('1.4.0-beta.1', '<= 1.4.0')).toBe(true);
    expect(inVulnerableRange('1.0.0', 'some day')).toBeNull();
    expect(inVulnerableRange('1.0.0', '')).toBeNull();
  });

  it('reads the REST and GraphQL shape of a patched version', () => {
    expect(patchedVersionOf({ first_patched_version: '1.4.1' })).toBe('1.4.1');
    expect(patchedVersionOf({ first_patched_version: { identifier: '1.4.1' } })).toBe('1.4.1');
    expect(patchedVersionOf({ first_patched_version: null })).toBeNull();
  });
});

describe('where the entries are read from', () => {
  it('lists block and inline entries, and skips retired (commented) ones', () => {
    expect(listSuppressions('auditConfig:\n  ignoreGhsas:\n    # why\n    - GHSA-aaaa-bbbb-cccc\n    # - GHSA-dddd-eeee-ffff\nallowBuilds:\n')).toEqual(['GHSA-aaaa-bbbb-cccc']);
    expect(listSuppressions('auditConfig:\n  ignoreGhsas: [GHSA-aaaa-bbbb-cccc, GHSA-dddd-eeee-ffff]\n')).toHaveLength(2);
    expect(listSuppressions('packages: []\n')).toEqual([]);
  });

  it("lists this template's own entry", () => {
    expect(listSuppressions(readFileSync(join(TEMPLATE, 'pnpm-workspace.yaml'), 'utf8'))).toContain(ID);
  });

  it('walks up to the nearest pnpm-workspace.yaml, as pnpm does', () => {
    // Native paths: the walk joins with node:path, so on Windows it asks for `D:\mono\…`.
    const mono = resolve('/mono');
    const app = join(mono, 'projects', 'app');
    const files = new Set([join(mono, 'pnpm-workspace.yaml')]);
    const exists = (p: string) => files.has(p);
    // Generated monorepo: lt hoisted auditConfig into the root and deleted the app's file.
    expect(findWorkspaceRoot(app, exists)).toBe(mono);
    // Standalone, or an app that kept its own file: that one wins.
    files.add(join(app, 'pnpm-workspace.yaml'));
    expect(findWorkspaceRoot(app, exists)).toBe(app);
    expect(findWorkspaceRoot(resolve('/elsewhere'), () => false)).toBeNull();
  });

  it('run() finds the hoisted root file in a monorepo layout, offline when nothing is suppressed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lt-suppressions-'));
    try {
      mkdirSync(join(dir, 'projects', 'app'), { recursive: true });
      writeFileSync(join(dir, 'pnpm-workspace.yaml'), "packages:\n  - 'projects/*'\n");
      const lines: string[] = [];
      expect(await run({ cwd: join(dir, 'projects', 'app'), env: {}, log: (l) => lines.push(l) })).toBe(0);
      expect(lines).toEqual(['[suppressions] none declared']);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});

type FetchCall = [url: string, init: { headers: Record<string, string> }];

function fakeFetch(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  const calls: FetchCall[] = [];
  const impl = (async (url: string, init: { headers: Record<string, string> }) => {
    calls.push([url, init]);
    return { headers: new Headers(headers), json: async () => body, status };
  }) as unknown as typeof fetch;
  return { calls, impl };
}

const offlineFetch = (async () => {
  throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
}) as unknown as typeof fetch;

describe('network lookups', () => {
  it('fetches the advisory, sending the token only when given', async () => {
    const f = fakeFetch(200, { ghsa_id: ID });
    expect(await createAdvisoryFetcher({ fetchImpl: f.impl })(ID)).toEqual({ advisory: { ghsa_id: ID }, ok: true });
    expect(f.calls[0]?.[0]).toBe(`https://api.github.com/advisories/${ID}`);
    expect(f.calls[0]?.[1].headers.Authorization).toBeUndefined();
    await createAdvisoryFetcher({ fetchImpl: f.impl, token: 't0k' })(ID);
    expect(f.calls[1]?.[1].headers.Authorization).toBe('Bearer t0k');
  });

  it('turns a rate limit, an unknown id and an outage into reasons, not advisories', async () => {
    expect(await createAdvisoryFetcher({ fetchImpl: fakeFetch(403, {}, { 'x-ratelimit-remaining': '0' }).impl })(ID)).toEqual({
      ok: false,
      reason: expect.stringMatching(/rate limit.*GITHUB_TOKEN/),
    });
    expect(await createAdvisoryFetcher({ fetchImpl: fakeFetch(404).impl })(ID)).toMatchObject({ ok: false });
    expect(await createAdvisoryFetcher({ fetchImpl: offlineFetch })(ID)).toEqual({ ok: false, reason: expect.stringContaining('ENOTFOUND') });
  });

  it('asks the version endpoint and maps its answers', async () => {
    expect(await createNpmVersionProbe({ fetchImpl: fakeFetch(200).impl })('node-forge', '1.4.0')).toBe(true);
    expect(await createNpmVersionProbe({ fetchImpl: fakeFetch(404).impl })('node-forge', '1.4.1')).toBe(false);
    expect(await createNpmVersionProbe({ fetchImpl: fakeFetch(503).impl })('node-forge', '1.4.1')).toBeNull();
    expect(await createNpmVersionProbe({ fetchImpl: offlineFetch })('node-forge', '1.4.1')).toBeNull();
    const f = fakeFetch(200);
    await createNpmVersionProbe({ fetchImpl: f.impl })('@scope/pkg', '2.0.0');
    expect(f.calls[0]?.[0]).toBe('https://registry.npmjs.org/@scope%2Fpkg/2.0.0');
  });
});

describe('wiring', () => {
  const pkg = JSON.parse(readFileSync(join(TEMPLATE, 'package.json'), 'utf8'));

  it('runs in every check chain: after the audit in raw and fix, after the install in naf', () => {
    expect(pkg.scripts['check:raw']).toContain('pnpm audit && node scripts/check-suppressions.mjs &&');
    expect(pkg.scripts['check:fix']).toContain('pnpm audit --fix && node scripts/check-suppressions.mjs &&');
    expect(pkg.scripts['check:naf']).toContain('pnpm install && node scripts/check-suppressions.mjs &&');
  });

  it('gives the step its own kind in check.mjs, so an unverified run is not a plain tick', () => {
    // Whole code lines, anchored: prose in a comment does not start with `return {` or `if (`.
    // (Stripping block comments by regex does not work on this file: glob strings such as
    // 'projects/*' look like a comment opener and swallow real code.)
    const source = readFileSync(join(TEMPLATE, 'scripts', 'check.mjs'), 'utf8');
    expect(source).toMatch(/^\s+if \(c\.includes\('check-suppressions'\).*return \{ fatal: true, kind: 'suppressions', label: 'suppressions' \};$/m);
    expect(source).toMatch(/^\s+if \(step\.kind === 'suppressions'\) r\.suppressions = parseSuppressionSummary\(out\);$/m);
  });
});
