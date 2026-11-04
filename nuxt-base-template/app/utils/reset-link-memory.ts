/**
 * Keeps a password-reset link across a reload of the page it arrived on, and nowhere else.
 *
 * `reset-password.vue` strips the token from the URL, so a reload would otherwise find none and
 * call a valid link dead. Remembering it is the risk: on a shared device the next person in the
 * tab must not receive it, or they can set the previous person's password.
 *
 * So the link is bound to the history entry that received it: a random id in `history.state`, and
 * the same id next to the token in `sessionStorage`. A reload keeps the entry and with it the id.
 * A redirect lands on an entry without that id, which "the document was reloaded" cannot tell
 * apart, because a reload counts for the whole document and not for one page of the app.
 *
 * `sessionStorage` throws when storage is blocked (private modes, site-data settings). Every
 * access below fails safely: a reload then loses the link, as it did before this memory existed.
 */

/** Key of the id in `history.state`. */
export const RESET_LINK_HISTORY_KEY = 'resetLinkId';

const STORAGE_KEY = 'reset-password-link';

/** `crypto.randomUUID()` would fit, but it exists in secure contexts only, unlike this. */
export function createResetLinkId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Replaces whatever was remembered: a token in the URL is always the newest link. */
export function rememberResetLink(id: string, token: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ id, token }));
  } catch {
    // See above: without storage only the reload case is lost.
  }
}

/** The token remembered under exactly this id, otherwise an empty string. */
export function recallResetLink(id: unknown): string {
  if (typeof id !== 'string' || !id) {
    return '';
  }
  try {
    const stored: unknown = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? 'null');
    const { id: storedId, token } = (stored ?? {}) as { id?: unknown; token?: unknown };
    return storedId === id && typeof token === 'string' ? token : '';
  } catch {
    return '';
  }
}

export function forgetResetLink(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // See above.
  }
}
