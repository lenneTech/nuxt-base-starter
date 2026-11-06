/**
 * The repository root is a pnpm workspace of exactly one project, and says so.
 *
 * Without a `packages:` field the two halves of pnpm disagree about what the workspace is. `pnpm
 * install` takes the root alone (`["."]`) and records one project. The check that runs before every
 * `pnpm run` finds projects with the default `[".", "**"]` and counts `nuxt-base-template/` as well.
 * Two against one reads as "The workspace structure has changed since last install": every root
 * `pnpm run` installed again and then warned "The install that ran before the script left
 * node_modules out of date". Measured on pnpm 11.28.10 (2026-11-06): with `packages: ['.']` both
 * count one project, the lockfile stays as it is, and the warning is gone.
 *
 * The template keeps its own `pnpm-workspace.yaml` and lockfile; pnpm reads the nearest one, so this
 * file never reaches it, and `lt fullstack init` copies only `nuxt-base-template/`.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const workspace = readFileSync(new URL('../pnpm-workspace.yaml', import.meta.url), 'utf8');

/** The entries of the top-level `packages:` list, quotes removed. */
function packageEntries() {
  const block = /^packages:[ \t]*\n((?:[ \t]+-[^\n]*(?:\n|$))+)/m.exec(workspace)?.[1] ?? '';
  return [...block.matchAll(/^[ \t]+-[ \t]*['"]?([^'"\n]+?)['"]?[ \t]*$/gm)].map((match) => match[1]);
}

test('the root pnpm-workspace.yaml lists the root as its only project', () => {
  assert.deepEqual(packageEntries(), ['.']);
});

test('the template stays a project of its own, with its own workspace file and lockfile', () => {
  assert.ok(existsSync(new URL('../nuxt-base-template/pnpm-workspace.yaml', import.meta.url)));
  assert.ok(existsSync(new URL('../nuxt-base-template/pnpm-lock.yaml', import.meta.url)));
});
