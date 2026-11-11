/**
 * Every `<UForm>` binds `:state`.
 *
 * Nuxt UI's UForm validates its `state` against `schema` before it emits `submit`. Without `:state`
 * it validates `undefined`: every required field fails, `@error` fires instead, and the submit
 * handler never runs. No request goes out and no message shows, so the button looks dead. That was
 * the "Neue Backup-Codes generieren" dialog (ModalBackupCodes.vue, found in a project's browser
 * walk, 2026-11-11): its form had a schema and a submit handler, but no state and no `v-model`.
 *
 * Read as text, like the other contract tests: the question is structural. A `<UForm>` without a
 * schema could live without state, but every form here has one, so the rule has no exception.
 * `tests/e2e/auth-lifecycle.spec.ts` (Step 6) generates new backup codes against a real API.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const APP = join(ROOT, 'app');
/** Vendor mode: app/core/ is @lenne.tech/nuxt-extensions, linted and tested in its own repository. */
const isProjectVue = (file: string): boolean => file.endsWith('.vue') && !relative(APP, file).startsWith('core');

const forms = readdirSync(APP, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => join(entry.parentPath, entry.name))
  .filter(isProjectVue)
  .flatMap((file) =>
    // `<UForm` followed by whitespace or `>`, so `<UFormField>` does not count.
    [...readFileSync(file, 'utf8').matchAll(/<UForm(?=[\s>])[^>]*>/g)].map((match) => ({ file: relative(ROOT, file), tag: match[0] })),
  );

describe('UForm state contract', () => {
  it('finds the forms', () => {
    // Any form at all: a scan that finds none checks nothing. Not a fixed count, because a project
    // that copies this test may have fewer forms than the template (an older one has five).
    expect(forms.length).toBeGreaterThan(0);
  });

  it.each(forms)('$file binds :state on its UForm', ({ file, tag }) => {
    expect(tag, `${file}: a UForm without :state validates undefined and never submits`).toMatch(/\s(?::state|v-bind:state)=/);
  });
});
