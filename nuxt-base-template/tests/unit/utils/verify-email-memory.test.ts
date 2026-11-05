/**
 * app/utils/verify-email-memory.ts: the e-mail address of `/auth/verify-email` lives in the history
 * entry, never in the URL. `tests/e2e/auth-verify-email-url.spec.ts` runs the page against a real API.
 */
import { describe, expect, it } from 'vitest';

import { recallVerifyEmail, verifyEmailState } from '../../../app/utils/verify-email-memory';

describe('verifyEmailState and recallVerifyEmail', () => {
  it('hand the address over and back', () => {
    expect(recallVerifyEmail(verifyEmailState('max@test.com'))).toEqual({ email: 'max@test.com', verified: false });
  });

  it('carry the outcome of an accepted link', () => {
    expect(recallVerifyEmail(verifyEmailState('max@test.com', true))).toEqual({ email: 'max@test.com', verified: true });
  });

  it("find the page's entry among vue-router's own keys", () => {
    const state = { back: '/auth/login', current: '/auth/verify-email', position: 3, ...verifyEmailState('max@test.com') };

    expect(recallVerifyEmail(state).email).toBe('max@test.com');
  });

  it.each([
    ['no state', null],
    ['a state of another page', { back: '/auth/login', current: '/auth/verify-email' }],
    ['an entry of the wrong shape', { ltVerifyEmail: 'max@test.com' }],
    ['values of the wrong type', { ltVerifyEmail: { email: 42, verified: 'yes' } }],
  ])('remember nothing from %s', (_label, state) => {
    expect(recallVerifyEmail(state)).toEqual({ email: '', verified: false });
  });
});
