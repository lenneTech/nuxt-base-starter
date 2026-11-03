import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The email field of an auth form names `username` when the form has a password field, and
 * `email` when it has none.
 *
 * `username` does not mean a separate user-name concept. It is the token for the identifier that
 * belongs to the password, and it is what the password manager pairs with `current-password` or
 * `new-password`. `email` addresses the address autofill instead: the browser offers the address
 * from the profile but does not tie it to the stored credential, and offers less readily to save a
 * new one. `type: 'email'` stays either way, so validation and the mobile keyboard do not change.
 *
 * The template shipped `email` on login, register and setup (DEV-3147). forgot-password has no
 * password field, so there is nothing to pair and `email` is right there.
 *
 * Read as text, like the other auth page contracts.
 */

const AUTH_PAGES_DIR = 'app/pages/auth';

function authPages(): string[] {
  return readdirSync(AUTH_PAGES_DIR)
    .filter((name) => name.endsWith('.vue'))
    .sort();
}

/** Source with comments stripped, so a comment that quotes a token does not count as a field. */
function code(page: string): string {
  return readFileSync(`${AUTH_PAGES_DIR}/${page}`, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

/** The flat field objects (`{ autocomplete, label, name, … }`) of the page's `fields` arrays. */
function fieldObjects(source: string): string[] {
  return source.match(/\{[^{}]*\bname:\s*'[^']+'[^{}]*\}/g) ?? [];
}

function emailAutocomplete(page: string): string | undefined {
  const field = fieldObjects(code(page)).find((object) => /\bname:\s*'email'/.test(object));
  return field?.match(/\bautocomplete:\s*'([^']+)'/)?.[1];
}

function hasPasswordField(page: string): boolean {
  return fieldObjects(code(page)).some((object) => /\btype:\s*'password'/.test(object));
}

const pagesWithEmail = authPages().filter((page) => fieldObjects(code(page)).some((object) => /\bname:\s*'email'/.test(object)));

describe('auth form autocomplete', () => {
  it('finds the email field on the pages DEV-3147 is about', () => {
    expect(pagesWithEmail).toEqual(expect.arrayContaining(['forgot-password.vue', 'login.vue', 'register.vue', 'setup.vue']));
    expect(hasPasswordField('login.vue')).toBe(true);
    expect(hasPasswordField('forgot-password.vue')).toBe(false);
  });

  it.each(pagesWithEmail)('%s names the token that matches its password field', (page) => {
    const expected = hasPasswordField(page) ? 'username' : 'email';
    expect(emailAutocomplete(page), `${page}: the email field needs autocomplete '${expected}'`).toBe(expected);
  });
});
