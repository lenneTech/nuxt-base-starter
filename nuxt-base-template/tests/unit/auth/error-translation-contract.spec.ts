import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guards the error-translation chain against the failure mode that hides itself.
 *
 * WHAT GOES WRONG, AND WHY NOBODY NOTICES
 *
 * `useLtErrorTranslation` loads its table once at app start from `GET /i18n/errors/:locale`.
 * When that request fails the error is swallowed twice — `loadTranslations` catches it and
 * only warns, and the plugin wraps the same call in a second try/catch that also only warns.
 * The table stays empty, and `parseError` then falls through `localeTranslations[code] ||
 * developerMessage` to the ENGLISH developer text.
 *
 * The result is a plausible-looking string. Nobody reports it, because it reads like the
 * error message rather than like a broken translation layer. A backend that answers 502 for
 * twenty-five minutes after a deploy — which happened in production on a sibling project —
 * leaves every app instance started in that window permanently untranslated.
 *
 * WHY THIS FILE EXISTS NEXT TO `error-translation.spec.ts`
 *
 * That suite reimplements the parser to test it. A reimplementation cannot catch the parser
 * changing, and it had in fact already drifted: it accepts `#ABC:` and an empty message,
 * both of which the real expression rejects. So the assertions here run against the
 * expression SHIPPED BY THE INSTALLED PACKAGE, not a copy of it.
 */

/** Where the composable lives in npm mode and in vendor mode. First hit wins. */
const CANDIDATE_PATHS = [
  'node_modules/@lenne.tech/nuxt-extensions/dist/runtime/composables/use-lt-error-translation.js',
  'app/core/runtime/composables/use-lt-error-translation.ts',
];

/**
 * The `ERROR_CODE_REGEX` the app actually runs, read out of the shipped source.
 *
 * Reading the file rather than importing the module is deliberate: the composable pulls in
 * `#imports` and the auth-state helpers, so importing it would drag half a Nuxt runtime into
 * a test whose subject is one regular expression.
 */
function shippedErrorCodeRegex(): RegExp {
  const path = CANDIDATE_PATHS.find((candidate) => existsSync(candidate));

  // A missing file means the dependency moved, and silently skipping would turn this guard
  // into decoration — green forever, checking nothing.
  expect(path, `Could not find use-lt-error-translation in any of: ${CANDIDATE_PATHS.join(', ')}`).toBeDefined();

  const source = readFileSync(path as string, 'utf8');
  const match = source.match(/ERROR_CODE_REGEX\s*=\s*(\/.+?\/)[gimsuy]*\s*;/);

  expect(match, 'ERROR_CODE_REGEX is no longer declared in the shape this test reads').not.toBeNull();

  const [, pattern] = match as RegExpMatchArray;
  return new RegExp((pattern as string).slice(1, -1));
}

describe('shipped error-code parser', () => {
  it('recognises the marker nest-server puts on wrapped IAM errors', () => {
    // The exact string a failed password reset carries once nest-server has wrapped it. If
    // this stops matching, every IAM error reaches users as English developer text again.
    const match = '#LTNS_0027: Link is invalid or expired'.match(shippedErrorCodeRegex());

    expect(match?.[1]).toBe('LTNS_0027');
    expect(match?.[2]).toBe('Link is invalid or expired');
  });

  it('recognises project codes, not just LTNS ones', () => {
    // A project registry (`PROJ_0001` and up) merges into the same table server-side. A
    // parser that only understood `LTNS_` would leave every project-defined error in English.
    expect('#PROJ_0101: Order already shipped'.match(shippedErrorCodeRegex())?.[1]).toBe('PROJ_0101');
  });

  it('does not treat a bare Better-Auth code as a marker', () => {
    // Better-Auth's own codes carry no `#` and no digits. Were they to match, the parser
    // would look them up, miss, and hand back a mangled message.
    expect('INVALID_TOKEN'.match(shippedErrorCodeRegex())).toBeNull();
    expect('#INVALID_TOKEN: Invalid token'.match(shippedErrorCodeRegex())).toBeNull();
  });

  it('requires a message after the colon', () => {
    // `(.+)` not `(.*)`. Worth pinning because the sibling suite's copy accepts the empty
    // form, and a parser that matched it would return an empty translated message — a blank
    // toast, which is the one outcome worse than an untranslated one.
    expect('#LTNS_0027:'.match(shippedErrorCodeRegex())).toBeNull();
  });
});

describe('silent-failure contract', () => {
  /** The fallback exactly as `parseError` performs it. */
  function translate(message: string, table: Record<string, string>): string {
    const match = message.match(shippedErrorCodeRegex());
    if (!match) {
      return message;
    }
    return table[match[1] as string] || (match[2] as string);
  }

  const WRAPPED = '#LTNS_0027: Link is invalid or expired';
  const GERMAN = 'Dieser Link ist nicht (mehr) gültig. Bitte fordere einen neuen an.';

  it('translates when the table arrived', () => {
    expect(translate(WRAPPED, { LTNS_0027: GERMAN })).toBe(GERMAN);
  });

  it('returns a plausible English string when the table is empty — the whole problem', () => {
    const result = translate(WRAPPED, {});

    // Not an error, not empty, not the input either. It is the developer message, which is
    // why a broken translation layer is indistinguishable from a working one by looking at
    // the output alone. This assertion documents the defect rather than a desired behaviour.
    expect(result).toBe('Link is invalid or expired');
    expect(result).not.toBe(WRAPPED);
    expect(result.length).toBeGreaterThan(0);
  });

  it('exposes isLoaded, the one signal that CAN tell the two apart', () => {
    // `isLoaded` is `!!translations.value[locale]` — false in exactly the broken state above.
    // It already exists and nothing consumes it. Anything that must not show English (a
    // server-rendered page, a screenshot test, a health check) has to read this rather than
    // inspect the message, because the message looks fine either way.
    const path = CANDIDATE_PATHS.find((candidate) => existsSync(candidate)) as string;
    const source = readFileSync(path, 'utf8');

    expect(source).toContain('isLoaded');
    expect(source).toMatch(/isLoaded\s*[=:]/);
  });
});
