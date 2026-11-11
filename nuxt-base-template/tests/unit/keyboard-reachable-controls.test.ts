/**
 * No link or button in the app is taken out of the keyboard order.
 *
 * `tabindex="-1"` on a link or a button removes it from the Tab sequence, so a keyboard or switch user
 * cannot reach it at all (WCAG 2.1.1). "Passwort vergessen?" on the login page carried it: without a
 * mouse, the only way into the reset flow was typing its URL. `tests/e2e/auth-keyboard.spec.ts` walks
 * that link with the keyboard; this test catches the attribute on every link and button before a
 * browser runs.
 *
 * `tabindex="-1"` stays legitimate on an element that code focuses and Tab never should, such as the
 * API heading on `/app/admin/system`. Those are no links or buttons, and this test leaves them alone.
 * The vendored `app/core/` (vendor mode) is the framework's and is not checked here.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_DIR = join(import.meta.dirname, '..', '..', 'app');

/**
 * An opening tag of a link or button with a static or bound `tabindex` of -1. Quoted attribute values
 * are skipped whole, so the `>` of a handler such as `@click="() => open()"` does not end the tag early.
 */
const UNREACHABLE = /<(ULink|NuxtLink|RouterLink|UButton|a|button)\b(?:[^>"']|"[^"]*"|'[^']*')*?\s(?::|v-bind:)?tabindex=["']-1["']/g;

function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return dir === APP_DIR && entry.name === 'core' ? [] : vueFiles(path);
    return entry.name.endsWith('.vue') ? [path] : [];
  });
}

function unreachableControls(source: string): string[] {
  return [...source.matchAll(UNREACHABLE)].map((match) => match[0].replace(/\s+/g, ' '));
}

describe('keyboard-reachable links and buttons', () => {
  it('finds a link or button with tabindex -1 (self-test)', () => {
    expect(unreachableControls('<ULink to="/auth/forgot-password" class="x" tabindex="-1">Passwort vergessen?</ULink>')).toHaveLength(1);
    expect(unreachableControls('<UButton\n  label="Speichern"\n  :tabindex="-1"\n/>')).toHaveLength(1);
    // A `>` inside a quoted handler does not end the tag before the attribute.
    expect(unreachableControls('<UButton icon="i-lucide-x" @click="() => open()" tabindex="-1" />')).toHaveLength(1);
    expect(unreachableControls('<h3 ref="apiHeading" tabindex="-1">API (Backend)</h3>')).toEqual([]);
    expect(unreachableControls('<ULink to="/x" tabindex="0">X</ULink>')).toEqual([]);
  });

  it('no page, layout or component takes a link or button out of the Tab order', () => {
    const files = vueFiles(APP_DIR);
    expect(files.length, 'Vue files under app/').toBeGreaterThan(10);

    const offenders = files.flatMap((file) => unreachableControls(readFileSync(file, 'utf8')).map((tag) => `${relative(APP_DIR, file)}: ${tag}`));
    expect(offenders).toEqual([]);
  });
});
