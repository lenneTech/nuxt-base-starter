// Contract: the CI-placement guard must actually FIRE.
//
// The guard exists because this repo released for a long time without testing
// itself: the root held only `release.yml` (tag-triggered, tests nothing) while
// `nuxt-base-template/.github/workflows/test.yml` sat one directory down looking
// exactly like a pipeline. GitHub reads workflows from the repository root only,
// so that file never ran here — and a better-auth bump shipped through it,
// splitting client from server across every fullstack project.
//
// Every rule below is driven from BOTH sides: a positive control proving the
// guard ARMS on the shape, and a negative control proving it FIRES on the
// defect. A rule only ever asserted in its passing state is indistinguishable
// from a rule that is never evaluated at all.
//
// The guard is a top-level script, so it is exercised the way it really runs:
// copied into a synthetic repo and executed, with the exit code and the message
// as the contract.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, it } from 'node:test';

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD = join(HERE, 'check-ci-placement.mjs');

const dirs = [];
after(() =>
  dirs.forEach((d) => {
    // Unguarded, one EPERM/EBUSY abandons every remaining dir (`force` only
    // suppresses ENOENT).
    try {
      rmSync(d, { force: true, maxRetries: 2, recursive: true });
    } catch {
      /* a leaked tmp dir is not worth failing a green suite over */
    }
  }),
);

/** A tag-triggered release pipeline — present, but not self-testing. */
const RELEASE_ONLY = `name: Release\n\non:\n  push:\n    tags:\n      - 'v*'\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n`;

/** Runs on ordinary development activity. */
const SELF_TESTING = `name: Tests\n\non:\n  push:\n    branches: [main]\n  pull_request:\n    branches: [main]\n\njobs:\n  check:\n    runs-on: ubuntu-latest\n`;

/** A job with service containers — the only kind that can boot a DB or an API. */
const WITH_SERVICES = `${SELF_TESTING}\n  e2e:\n    runs-on: ubuntu-latest\n    services:\n      mongodb:\n        image: mongo:7\n`;

/**
 * Builds a synthetic repo.
 *
 * @param layout - { rootWorkflows: {name: text}, dirs: { 'some/dir': {name: text} } }
 */
function buildRepo(layout = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ci-placement-'));
  dirs.push(dir);

  mkdirSync(join(dir, 'scripts'), { recursive: true });
  copyFileSync(GUARD, join(dir, 'scripts', 'check-ci-placement.mjs'));

  for (const [name, text] of Object.entries(layout.rootWorkflows ?? {})) {
    mkdirSync(join(dir, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(dir, '.github', 'workflows', name), text);
  }

  for (const [sub, files] of Object.entries(layout.dirs ?? {})) {
    for (const [name, text] of Object.entries(files)) {
      const target = join(dir, sub, '.github', 'workflows');
      mkdirSync(target, { recursive: true });
      writeFileSync(join(target, name), text);
    }
  }

  return dir;
}

function runGuard(dir) {
  const r = spawnSync(process.execPath, [join(dir, 'scripts', 'check-ci-placement.mjs')], { encoding: 'utf8' });
  return { out: `${r.stdout ?? ''}${r.stderr ?? ''}`, status: r.status };
}

/** The repaired shape: root tests itself AND mirrors the template's behaviour stage. */
const healthy = () => ({
  dirs: { 'nuxt-base-template': { 'test.yml': WITH_SERVICES } },
  rootWorkflows: { 'release.yml': RELEASE_ONLY, 'test.yml': WITH_SERVICES },
});

describe('check-ci-placement', () => {
  it('POSITIVE CONTROL — passes on the repaired layout', () => {
    const { out, status } = runGuard(buildRepo(healthy()));
    assert.equal(status, 0, out);
    assert.match(out, /ok —/);
    // Proves it actually SAW the behaviour stage rather than skipping the check.
    assert.match(out, /behaviour stage mirrored/);
  });

  it('FIRES when the root only releases — the state that shipped the split', () => {
    const layout = healthy();
    delete layout.rootWorkflows['test.yml'];
    const { out, status } = runGuard(buildRepo(layout));

    assert.equal(status, 1, out);
    assert.match(out, /no workflow that runs on pushes or pull requests/);
    // Must say the release pipeline is not a substitute, not just "missing file".
    assert.match(out, /release-only pipeline never tests what it releases/);
  });

  it('FIRES when the root has no workflows at all', () => {
    const { out, status } = runGuard(buildRepo({ dirs: { 'nuxt-base-template': { 'test.yml': SELF_TESTING } } }));
    assert.equal(status, 1, out);
    assert.match(out, /no root workflows at all/);
  });

  it('FIRES when a workflow sits in a directory that is not a declared template', () => {
    const layout = healthy();
    layout.dirs['packages/thing'] = { 'ci.yml': SELF_TESTING };
    const { out, status } = runGuard(buildRepo(layout));

    assert.equal(status, 1, out);
    assert.match(out, /packages\/thing.*will never run/s);
    // The message must offer both ways out, or the reader guesses.
    assert.match(out, /Move it to \.github\/workflows\//);
    assert.match(out, /TEMPLATE_DIRS/);
  });

  it('FIRES when the template ships a behaviour stage the root lacks', () => {
    // Root tests itself, but only with plain jobs — no services, so it cannot
    // boot an API and cannot see a broken cross-repo contract.
    const { out, status } = runGuard(
      buildRepo({
        dirs: { 'nuxt-base-template': { 'test.yml': WITH_SERVICES } },
        rootWorkflows: { 'test.yml': SELF_TESTING },
      }),
    );

    assert.equal(status, 1, out);
    assert.match(out, /template ships a behaviour stage the root does not run/);
    assert.match(out, /nuxt-base-template\/\.github\/workflows\/test\.yml/);
  });

  it('does not demand a behaviour stage the template does not have either', () => {
    const { out, status } = runGuard(
      buildRepo({
        dirs: { 'nuxt-base-template': { 'test.yml': SELF_TESTING } },
        rootWorkflows: { 'test.yml': SELF_TESTING },
      }),
    );
    assert.equal(status, 0, out);
    assert.doesNotMatch(out, /behaviour stage/);
  });

  it('does not mistake a tag-only push trigger for self-testing', () => {
    // The distinction the whole guard turns on: `on: push:` is present in a
    // release pipeline too. Only `branches:` under it counts.
    const { status } = runGuard(buildRepo({ rootWorkflows: { 'release.yml': RELEASE_ONLY } }));
    assert.equal(status, 1);
  });

  it('ignores workflows inside node_modules', () => {
    const layout = healthy();
    layout.dirs['node_modules/some-dep'] = { 'ci.yml': SELF_TESTING };
    const { out, status } = runGuard(buildRepo(layout));
    assert.equal(status, 0, out);
  });
});
