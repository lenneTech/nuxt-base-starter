/**
 * Where `/auth/verify-email` keeps the e-mail address: in the history entry, never in the URL.
 *
 * "Send a new e-mail" needs the address, and it used to travel as `?email=` from the login and the
 * sign-up. In the URL it went to analytics, into the referrer of links, into the browser history
 * and into every link somebody pasted while asking for help. The history entry keeps it out of all
 * of that and still survives a reload of the page.
 *
 * Login and sign-up hand it over with `navigateTo({ path, state: verifyEmailState(email) })`. The
 * link in the verification mail still carries `token` and `email` (nest-server builds it), so the
 * page moves both out of the URL the moment it has read them.
 */

/** Key of the page's entry in `history.state`. */
const VERIFY_EMAIL_STATE_KEY = 'ltVerifyEmail';

/** What the history entry remembers for the page. A type, not an interface: vue-router's `HistoryState` needs an index signature. */
export type VerifyEmailMemory = {
  email: string;
  /** Set once the link was accepted, so a reload shows the confirmation rather than the waiting page. */
  verified: boolean;
};

/** The history state that hands the address, and the outcome, to `/auth/verify-email`. */
export function verifyEmailState(email: string, verified = false): Record<string, VerifyEmailMemory> {
  return { [VERIFY_EMAIL_STATE_KEY]: { email, verified } };
}

/** What a history state remembers for the page, whatever else it holds. */
export function recallVerifyEmail(state: unknown): VerifyEmailMemory {
  const entry = state !== null && typeof state === 'object' ? (state as Record<string, unknown>)[VERIFY_EMAIL_STATE_KEY] : undefined;
  if (entry === null || typeof entry !== 'object') {
    return { email: '', verified: false };
  }
  const { email, verified } = entry as Record<string, unknown>;
  return { email: typeof email === 'string' ? email : '', verified: verified === true };
}
