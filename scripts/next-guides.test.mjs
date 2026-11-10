/**
 * A migration guide for a change to the starter alone is named `migration-guides/next-<topic>.md`,
 * and it has to be renamed to `<version>-<topic>.md` in the bump PR of the release it ships in
 * (CLAUDE.md, "Versioning").
 *
 * Such a change goes to `main` without a version of its own, so when its guide is written nobody
 * knows the number yet. The number comes with the next nuxt-extensions release: its bump PR raises
 * the root `version`, and the release commit after the squash merge adds the changelog section.
 * Between those two steps the root `version` is ahead of the newest version in CHANGELOG.md. That is
 * the moment to rename, and this test fails while a `next-` guide is still there. Outside a release
 * both numbers are equal and `next-` guides may wait.
 *
 * Lives in the repository root: `lt fullstack init` copies only `nuxt-base-template/`, and the
 * guides are not part of a generated project.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

/** The newest version in a changelog: the first `## [x.y.z]` or `### [x.y.z]` heading. */
export function newestChangelogVersion(changelog) {
  return /^#{2,3} \[(\d+\.\d+\.\d+)\]/m.exec(changelog)?.[1];
}

/** Guides that still wait for a number although a release is being prepared; empty outside a release. */
export function guidesToRename({ changelogVersion, guides, version }) {
  if (version === changelogVersion) return [];
  return guides.filter((name) => name.startsWith('next-'));
}

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const changelogVersion = newestChangelogVersion(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'));
const guides = readdirSync(new URL('../migration-guides/', import.meta.url)).filter((name) => name.endsWith('.md'));

test('CHANGELOG.md names its newest version in the first release heading', () => {
  assert.match(changelogVersion ?? '', /^\d+\.\d+\.\d+$/, 'no `## [x.y.z]` / `### [x.y.z]` heading found in CHANGELOG.md');
});

test('a release being prepared has no `next-` guide left', () => {
  const pending = guidesToRename({ changelogVersion, guides, version });
  assert.deepEqual(
    pending,
    [],
    `package.json is at ${version}, CHANGELOG.md at ${changelogVersion}: this is a release, so rename ${pending
      .map((name) => `migration-guides/${name} to ${version}-${name.slice('next-'.length)}`)
      .join(', ')} in this PR, and link it in the release commit's changelog section`,
  );
});

test('the rule itself: `next-` guides wait outside a release and block one in preparation (self-test)', () => {
  const sample = ['2.38.x-to-4.0.0.md', 'next-a.md', 'next-b.md'];
  assert.deepEqual(guidesToRename({ changelogVersion: '4.0.1', guides: sample, version: '4.0.1' }), []);
  assert.deepEqual(guidesToRename({ changelogVersion: '4.0.1', guides: sample, version: '4.0.2' }), ['next-a.md', 'next-b.md']);
  assert.deepEqual(guidesToRename({ changelogVersion: '4.0.1', guides: ['4.0.2-a.md'], version: '4.0.2' }), []);
  assert.equal(newestChangelogVersion('# Changelog\n\n### [4.0.1](x) (d)\n\n## [4.0.0](y) (d)\n'), '4.0.1');
  assert.equal(newestChangelogVersion('# Changelog\n\n## [5.1.0](x) (d)\n'), '5.1.0');
});
