import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Every auth page must run backend errors through `translateError`.
 *
 * WHY A STRUCTURAL TEST RATHER THAN A BETTER COMPOSABLE
 *
 * Two independent projects built on this template were measured while this guard was being
 * written. In one, four of seven auth pages skipped the translation layer; in the other, two
 * of four. Both times it was the RECOVERY flows — forgot-password, reset-password,
 * verify-email, 2fa — that is, the pages reached by someone who is already locked out and
 * has the least patience for English developer text.
 *
 * Neither project had a reason for it. The composable was simply not wired up on pages
 * written later, and nothing made the omission visible: a page that skips translation looks
 * exactly like one that does not, right up until an error occurs in production. No
 * improvement to the composable can fix that, because the broken pages never call it. What
 * helps is making the omission fail a test.
 *
 * The template itself had drifted the same way on `verify-email.vue`, which built its
 * requests with raw `$fetch` and reported failures in its own words.
 *
 * WHY IT MATTERS MORE NOW THAN IT DID
 *
 * nest-server wraps failed `/iam/*` responses so their message carries `#LTNS_…`. A page
 * that prints `error.message` unfiltered therefore no longer shows English prose — it shows
 * the raw marker, `#LTNS_0027: Link is invalid or expired`, which reads like a system fault.
 * Skipping the translation layer got worse, not better, with that rollout.
 */

const AUTH_PAGES_DIR = 'app/pages/auth';

/**
 * Pages that legitimately never surface a backend error.
 *
 * Empty on purpose, and it should stay that way: every current page talks to the API. An
 * entry here needs a reason in a comment, not just a name — the point of the guard is that
 * skipping translation must be a decision somebody wrote down.
 */
const EXEMPT: readonly string[] = [];

function authPages(): string[] {
  return readdirSync(AUTH_PAGES_DIR)
    .filter((name) => name.endsWith('.vue'))
    .sort();
}

/**
 * Source with comments stripped.
 *
 * Without this the guard reports the comments that EXPLAIN the forbidden patterns — the
 * first run failed on two files whose only offence was documenting why the pattern is wrong.
 * A test that punishes its own explanation teaches people to delete the explanation.
 */
function code(page: string): string {
  return readFileSync(`${AUTH_PAGES_DIR}/${page}`, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

describe('auth pages route errors through translateError', () => {
  it('finds the auth pages at all', () => {
    // Without this, a moved directory would empty the loop below and every assertion would
    // vanish silently — the guard would pass by having nothing to check.
    expect(authPages().length).toBeGreaterThanOrEqual(7);
  });

  it.each(authPages())('%s translates backend errors', (page) => {
    if (EXEMPT.includes(page)) {
      return;
    }

    const source = code(page);

    expect(
      source,
      `${page} does not use useLtErrorTranslation. Backend errors reach the user as raw text — after nest-server's wrapping that means a visible "#LTNS_…" marker.`,
    ).toContain('useLtErrorTranslation');
    expect(source, `${page} imports the composable but never calls translateError.`).toContain('translateError');
  });

  it.each(authPages())('%s does not display a raw error message', (page) => {
    if (EXEMPT.includes(page)) {
      return;
    }

    // The other half of the same drift, seen in both sibling projects: a raw `error.message`
    // handed straight to the user. After nest-server's wrapping that renders the literal
    // marker text.
    //
    // Scoped to the display field, and both halves of that scoping were learned by getting
    // it wrong. `const msg = error.message || 'Fallback'` followed by `translateError(msg)`
    // is CORRECT and appears in login.vue and register.vue; so is
    // `description: err.message ? translateError(err.message) : …` in 2fa.vue, where the raw
    // value is only the condition. Earlier versions of this guard flagged all three, which
    // would have taught people to work around the test. What matters is not how the string
    // is built but whether it reaches the reader untranslated.
    //
    // The whitespace belongs INSIDE the lookahead. Written as `\s*(?![?\w])` the engine
    // backtracks `\s*` to zero, the lookahead then sees a space, succeeds, and the guard
    // fires on exactly the correct code it was meant to allow.
    expect(code(page), `${page} shows a raw error message. Wrap it in translateError first.`).not.toMatch(/description:\s*[\w.]*error\.message(?!\s*[?\w])/);
  });
});

describe('translateError is not used as if it could return empty', () => {
  it.each(authPages())('%s does not guard translateError with ||', (page) => {
    const source = code(page);

    // `translateError(x) || 'Fallback'` looks like belt and braces and is a no-op: the
    // function returns the original message when it cannot translate, so the right-hand side
    // is unreachable for any non-empty input. Left in place it hides the untranslated case
    // behind a fallback that never runs — the reader believes there is a safety net.
    //
    // Where a genuine fallback is needed, compare against the input (see `verify-email.vue`)
    // instead of relying on emptiness.
    expect(source, `${page} uses translateError(...) || fallback, which never reaches the fallback.`).not.toMatch(/translateError\([^)]*\)\s*\|\|/);
  });
});
