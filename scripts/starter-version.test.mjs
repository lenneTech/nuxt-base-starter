/**
 * The starter carries the version of the nuxt-extensions release it pins (README.md, "Versioning").
 *
 * This file lives in the repository root on purpose. `lt fullstack init` copies `nuxt-base-template/`
 * and nothing else, tests included. A generated project carries its own version and upgrades
 * nuxt-extensions on its own, so there the two numbers are expected to differ, and a guard inside
 * the template would fail on a correct project.
 *
 * Here they must match. A release that bumps the pin and forgets the root version (or the other way
 * round) tags the template under a number that names a different framework release, and every
 * migration guide and changelog link of that release points at the wrong version.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const template = JSON.parse(readFileSync(new URL('../nuxt-base-template/package.json', import.meta.url), 'utf8'));
const pin = template.dependencies?.['@lenne.tech/nuxt-extensions'];

test('the template pins one exact nuxt-extensions version', () => {
  assert.match(pin ?? '', /^\d+\.\d+\.\d+$/, `nuxt-base-template/package.json pins "${pin}", not an exact version`);
});

test('the starter version equals the pinned nuxt-extensions version', () => {
  assert.equal(root.version, pin, `package.json version ${root.version} names no nuxt-extensions release; the template pins ${pin}`);
});
