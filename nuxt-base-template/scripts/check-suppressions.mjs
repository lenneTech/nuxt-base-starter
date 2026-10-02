#!/usr/bin/env node
/**
 * Re-check every audit suppression (`auditConfig.ignoreGhsas`) against the GitHub Advisory
 * Database, so a suppression cannot outlive its reason unnoticed.
 *
 * Why this exists: pnpm removes a suppressed advisory from `pnpm audit --json` completely. Once a
 * GHSA id is listed, no audit run mentions it again — if upstream ships a fix the next day, or the
 * package leaves the tree, the entry silently stops being justified. This template suppressed two
 * image-size advisories whose fix never shipped; the package left the tree instead, and the
 * entries outlived their cause by a full release cycle.
 *
 * Verdict per entry:
 *
 *   not-present      no package of the advisory resolves to a vulnerable version any more (read
 *                    from pnpm-lock.yaml), so the entry hides nothing — FAIL.
 *   withdrawn        the advisory was withdrawn — FAIL.
 *   fix-available    a patched version is installable from npm — FAIL: take the fix.
 *   fix-unpublished  a patched version is NAMED but not on the registry (node-forge, 2026-10:
 *                    `pnpm audit` named ">=1.4.1" while registry.npmjs.org/node-forge/1.4.1 was a
 *                    404). Still holds: there is nothing to install.
 *   unfixable        no patched version is named. Still holds.
 *   unverified       the lookup could not be made: offline, rate-limited, unknown id, lockfile or
 *                    registry unreadable, a range it cannot parse. NEVER reported as verified.
 *
 * Where the entries live: the nearest `pnpm-workspace.yaml` above this script — the same file
 * pnpm itself reads. Standalone that is this app's own file. In a generated monorepo `lt` hoists
 * `auditConfig` into the workspace root and deletes the app's settings-only file, so reading only
 * the app's file would find nothing and silently check nothing.
 *
 * Exit code: 1 when an entry is obsolete, or could not be verified in CI with a token
 * (`GITHUB_TOKEN` / `GH_TOKEN`); 0 otherwise. Without a token an unverified entry is a loud
 * warning only: unauthenticated, GitHub allows 60 requests per hour per IP, and GitLab runners are
 * shared by every project — a busy day must not turn pipelines red with nothing wrong in them.
 *
 * Same file as @lenne.tech/nuxt-extensions' `scripts/check-suppressions.mjs` + `lib/
 * suppression-check.mjs`, folded into one so it has no sibling imports and can be copied alone.
 */

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TAG = '[suppressions]';
const ADVISORY_API = 'https://api.github.com/advisories/';
const NPM_REGISTRY = 'https://registry.npmjs.org/';
const TIMEOUT_MS = 20_000;

/** Verdicts that make the check fail: the suppression is obsolete. */
export const OBSOLETE = new Set(['fix-available', 'not-present', 'withdrawn']);

/**
 * The nearest directory at or above `start` that holds a `pnpm-workspace.yaml` — pnpm's own
 * notion of the workspace root, and so the file whose `auditConfig` actually applies. Null when
 * there is none up to the filesystem root.
 */
export function findWorkspaceRoot(start, exists = existsSync) {
  let dir = start;
  for (;;) {
    if (exists(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * The GHSA ids listed under `ignoreGhsas`, in file order. Inline (`[a, b]`) and block form; a
 * commented-out entry is a retired suppression and does not count.
 */
export function listSuppressions(workspaceYaml) {
  const lines = String(workspaceYaml).split('\n');
  const keyIdx = lines.findIndex((l) => /^\s*"?ignoreGhsas"?\s*:/.test(l));
  if (keyIdx === -1) return [];
  const inline = lines[keyIdx].match(/ignoreGhsas"?\s*:\s*\[([^\]]*)\]/);
  if (inline) return inline[1].match(/GHSA-[0-9a-z]+(?:-[0-9a-z]+)*/gi) || [];
  const ids = [];
  for (const line of lines.slice(keyIdx + 1)) {
    if (/^\s*#/.test(line) || !line.trim()) continue;
    const entry = line.match(/^\s*-\s*"?(GHSA-[0-9a-z]+(?:-[0-9a-z]+)*)"?/i);
    if (!entry) break;
    ids.push(entry[1]);
  }
  return ids;
}

/**
 * Versions of `name` that a pnpm lockfile resolves, read from the `packages:` / `snapshots:` keys:
 * `  node-forge@1.4.0:`, `  '@scope/pkg@1.2.3':`, with an optional peer suffix `(peer@4.0.0)` and
 * the leading slash of lockfile v6 (`  /pkg@1.0.0:`).
 */
export function resolvedVersions(lockText, name) {
  const versions = new Set();
  for (const line of String(lockText).split('\n')) {
    const m = line.match(/^ {2}'?\/?(@?[^@\s'/]+(?:\/[^@\s']+)?)@(\d[^(:'\s]*)/);
    if (m && m[1] === name) versions.add(m[2]);
  }
  return [...versions];
}

function parseVersion(text) {
  const core = String(text).trim().replace(/^v/, '').split(/[-+]/)[0];
  const parts = core.split('.').map((n) => (/^\d+$/.test(n) ? Number(n) : Number.NaN));
  if (!parts.length || parts.length > 3 || parts.some((n) => Number.isNaN(n))) return null;
  while (parts.length < 3) parts.push(0);
  return parts;
}

/**
 * Whether `version` lies in a GitHub `vulnerable_version_range` such as `<= 1.4.0` or
 * `>= 2.0.0, < 2.1.4`. Null when either cannot be read. A pre-release counts as its release, the
 * conservative direction: it keeps the entry rather than calling it obsolete.
 */
export function inVulnerableRange(version, range) {
  const v = parseVersion(version);
  const constraints = String(range ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  if (!v || constraints.length === 0) return null;
  for (const constraint of constraints) {
    const m = constraint.match(/^(<=|>=|<|>|=)?\s*(\S+)$/);
    const bound = m && parseVersion(m[2]);
    if (!bound) return null;
    let cmp = 0;
    for (let i = 0; i < 3 && cmp === 0; i++) cmp = Math.sign(v[i] - bound[i]);
    const op = m[1] ?? '=';
    const holds = op === '<' ? cmp < 0 : op === '<=' ? cmp <= 0 : op === '>' ? cmp > 0 : op === '>=' ? cmp >= 0 : cmp === 0;
    if (!holds) return false;
  }
  return true;
}

/** First patched version of one advisory vulnerability (REST string or GraphQL `{ identifier }`). */
export function patchedVersionOf(vulnerability) {
  const value = vulnerability?.first_patched_version;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && typeof value.identifier === 'string' && value.identifier.trim()) return value.identifier.trim();
  return null;
}

/** Decide whether one suppression still holds. Network and lockfile access are injected. */
export async function assessSuppression(id, { fetchAdvisory, lockedVersions, npmHasVersion }) {
  const answer = await fetchAdvisory(id);
  if (!answer.ok) return { detail: answer.reason, id, status: 'unverified' };

  const advisory = answer.advisory ?? {};
  if (advisory.withdrawn_at) return { detail: `advisory withdrawn on ${String(advisory.withdrawn_at).slice(0, 10)}`, id, status: 'withdrawn' };

  const npmVulnerabilities = (advisory.vulnerabilities ?? []).filter((v) => v?.package?.ecosystem === 'npm' && typeof v.package.name === 'string' && v.package.name);
  if (npmVulnerabilities.length === 0) return { detail: 'the advisory names no npm package, so nothing here could be checked', id, status: 'unverified' };

  // Still in the tree? Checked before the fix: an entry whose package left the tree is obsolete
  // whether or not a fix exists — the image-size case a fix check alone never reports.
  let stillVulnerable = false;
  const locked = [];
  for (const vulnerability of npmVulnerabilities) {
    const name = vulnerability.package.name;
    const versions = lockedVersions(name);
    if (versions === null) return { detail: 'could not read pnpm-lock.yaml', id, status: 'unverified' };
    for (const version of versions) {
      const hit = inVulnerableRange(version, vulnerability.vulnerable_version_range);
      if (hit === null) return { detail: `cannot compare ${name}@${version} with the range "${vulnerability.vulnerable_version_range}"`, id, status: 'unverified' };
      if (hit) stillVulnerable = true;
      locked.push(`${name}@${version}`);
    }
  }
  if (!stillVulnerable) {
    const where = locked.length ? `the lockfile resolves only ${locked.join(', ')}` : 'the package no longer resolves at all';
    return { detail: `nothing vulnerable left in the tree: ${where}`, id, status: 'not-present' };
  }

  const namedButUnpublished = [];
  for (const vulnerability of npmVulnerabilities) {
    const version = patchedVersionOf(vulnerability);
    if (!version) continue;
    const name = vulnerability.package.name;
    const published = await npmHasVersion(name, version);
    if (published === true) return { detail: `${name}@${version} is published`, id, status: 'fix-available' };
    if (published !== false) return { detail: `could not ask the npm registry whether ${name}@${version} exists`, id, status: 'unverified' };
    namedButUnpublished.push(`${name}@${version}`);
  }
  if (namedButUnpublished.length) return { detail: `${namedButUnpublished.join(', ')} named, but not on the npm registry`, id, status: 'fix-unpublished' };
  const names = [...new Set(npmVulnerabilities.map((v) => v.package.name))].join(', ');
  return { detail: `still no patched version of ${names}`, id, status: 'unfixable' };
}

/**
 * Exit code for a finished run: obsolete always fails; unverified fails only in CI with a token,
 * where the lookup was expected to work (see the header for why not without one).
 */
export function exitCodeFor(results, { ci, token }) {
  if (results.some((r) => OBSOLETE.has(r.status))) return 1;
  if (ci && token && results.some((r) => r.status === 'unverified')) return 1;
  return 0;
}

/** The one machine-readable line `scripts/check.mjs` renders via its `parseSuppressionSummary`. */
export function summaryLine(results) {
  const total = results.length;
  if (total === 0) return `${TAG} none declared`;
  const obsolete = results.filter((r) => OBSOLETE.has(r.status)).length;
  if (obsolete) return `${TAG} OBSOLETE ${obsolete} of ${total}`;
  const unverified = results.filter((r) => r.status === 'unverified').length;
  if (unverified) return `${TAG} NOT verified ${unverified} of ${total}`;
  return `${TAG} verified ${total} of ${total}`;
}

/** Real GitHub Advisory lookup; the token, when given, lifts the per-IP quota. */
export function createAdvisoryFetcher({ fetchImpl = globalThis.fetch, token } = {}) {
  return async (id) => {
    let response;
    try {
      response = await fetchImpl(`${ADVISORY_API}${encodeURIComponent(id)}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'lenne.tech-nuxt-base-check',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      return { ok: false, reason: `GitHub Advisory API unreachable (${error?.cause?.code ?? error?.name ?? 'error'})` };
    }
    if (response.status === 200) {
      try {
        return { advisory: await response.json(), ok: true };
      } catch {
        return { ok: false, reason: 'GitHub Advisory API answered with unreadable JSON' };
      }
    }
    if ((response.status === 403 || response.status === 429) && response.headers?.get('x-ratelimit-remaining') === '0') {
      return { ok: false, reason: token ? 'GitHub API rate limit reached' : 'GitHub API rate limit reached — set GITHUB_TOKEN or GH_TOKEN' };
    }
    if (response.status === 404) return { ok: false, reason: `${id} is not in the GitHub Advisory Database` };
    return { ok: false, reason: `GitHub Advisory API answered HTTP ${response.status}` };
  };
}

/**
 * Real npm lookup: true when `name@version` resolves, false when the registry says it does not
 * exist, null when it could not be asked. The version-specific endpoint answers the moment a
 * version is published, unlike the CDN-cached packument `npm view` reads.
 */
export function createNpmVersionProbe({ fetchImpl = globalThis.fetch } = {}) {
  return async (name, version) => {
    try {
      const response = await fetchImpl(`${NPM_REGISTRY}${name.replace('/', '%2F')}/${encodeURIComponent(version)}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.status === 200) return true;
      if (response.status === 404) return false;
      return null;
    } catch {
      return null;
    }
  };
}

const LABEL = {
  'fix-available': '✗ FIX AVAILABLE',
  'fix-unpublished': '✓ still holds   ',
  'not-present': '✗ NOT IN TREE   ',
  unfixable: '✓ still holds   ',
  unverified: '! NOT verified  ',
  withdrawn: '✗ WITHDRAWN     ',
};

/** The CLI: find the workspace, assess every entry, print one line each plus the summary. */
export async function run({ cwd = dirname(dirname(fileURLToPath(import.meta.url))), env = process.env, log = console.log } = {}) {
  const root = findWorkspaceRoot(cwd);
  const ids = root ? listSuppressions(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')) : [];
  if (ids.length === 0) {
    log(summaryLine([]));
    return 0;
  }

  const token = env.GITHUB_TOKEN || env.GH_TOKEN || undefined;
  let lockText = null;
  try {
    lockText = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8');
  } catch {
    /* reported per entry as "could not read pnpm-lock.yaml" */
  }
  const deps = {
    fetchAdvisory: createAdvisoryFetcher({ token }),
    lockedVersions: (name) => (lockText === null ? null : resolvedVersions(lockText, name)),
    npmHasVersion: createNpmVersionProbe(),
  };
  const results = await Promise.all(ids.map((id) => assessSuppression(id, deps)));

  for (const r of results) log(`  ${LABEL[r.status]} ${r.id}  ${r.detail}`);
  if (results.some((r) => OBSOLETE.has(r.status))) {
    log(
      `\n${TAG} A suppression no longer has a reason. Take the fix if there is one (update or\n` +
        `  override), then remove the entry from \`auditConfig.ignoreGhsas\` in ${join(root, 'pnpm-workspace.yaml')}.\n` +
        '  `pnpm audit` must stay clean without it.',
    );
  } else if (results.some((r) => r.status === 'unverified')) {
    log(
      `\n${TAG} At least one suppression was NOT checked. Its reason may already be gone; nothing\n` +
        '  here says either way. Re-run with network access (and GITHUB_TOKEN when rate-limited).' +
        (env.CI && !token ? '\n  CI without a token only warns here: set GITHUB_TOKEN to make this a gate.' : ''),
    );
  }
  log(summaryLine(results));
  return exitCodeFor(results, { ci: Boolean(env.CI), token: Boolean(token) });
}

// Run only when invoked as the CLI, so tests can import the pure helpers.
function isCliEntry() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch (err) {
    // Fail closed: "cannot tell" must never become a green check that never ran.
    process.stderr.write(`${TAG} cannot resolve the CLI entry (${err?.code || err}) — refusing to report success\n`);
    process.exit(1);
  }
}

if (isCliEntry()) {
  process.exitCode = await run();
}
