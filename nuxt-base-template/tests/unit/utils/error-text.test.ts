/**
 * app/utils/error-text.ts: what an error toast says. A message with an error code (`#LTNS_…` from
 * nest-server, or a project's own `#…_0001:`) goes through `translateError`; any other message is
 * replaced by the page's own German text.
 */
import { describe, expect, it } from 'vitest';

// Through `~`, so the file runs unchanged in a project on `srcDir: './src'`.
import { errorText } from '~/utils/error-text';

/** As nuxt-extensions: a coded message comes back translated, anything else unchanged. */
const translateError = (message: string) => (message.startsWith('#LTNS_0002:') ? 'Das Passwort ist falsch.' : message);

describe('errorText', () => {
  it('translates a nest-server message with an error code', () => {
    expect(errorText('#LTNS_0002: Invalid password', translateError, '2FA konnte nicht aktiviert werden')).toBe('Das Passwort ist falsch.');
  });

  it('translates a project code in the same shape', () => {
    const projectTranslate = (message: string) => (message.startsWith('#PROJ_0001:') ? 'Projektfehler' : message);

    expect(errorText('#PROJ_0001: Something', projectTranslate, 'Fallback')).toBe('Projektfehler');
  });

  it.each([
    ['an English message of Better Auth', 'Invalid code'],
    ['a message that only mentions a code', 'Failed with #LTNS_0002: Invalid password'],
    ['an empty message', ''],
    ['no message at all', undefined],
    ['something that is not text', { message: 'Invalid code' }],
  ])('shows the German fallback for %s', (_label, message) => {
    expect(errorText(message, translateError, 'Der Code ist ungültig.')).toBe('Der Code ist ungültig.');
  });
});
