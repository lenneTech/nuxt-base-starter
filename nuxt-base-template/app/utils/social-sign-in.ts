/**
 * Sign-in through a social provider the API configures (`betterAuth.socialProviders` in
 * nest-server, listed by `GET /iam/features` as `socialProviders`). First use: Microsoft Entra ID
 * as single sign-on.
 *
 * `login.vue` shows one button per provider and, when the project opted in
 * (`NUXT_PUBLIC_AUTH_SILENT_PROVIDER`), tries ONCE per tab to take over the visitor's provider
 * session without showing anything (`prompt=none`), and after "Abmelden" in no tab of this browser
 * until the next completed sign-in. `callback.vue` finishes the sign-in. This file holds the parts of
 * that flow that need no Nuxt context: what a button shows, the marks that keep the silent attempt
 * from looping and from undoing a sign-out, and the text for an `?error=` the provider or Better
 * Auth sends the browser back with.
 */

/** What a provider's button shows. */
export interface SocialProviderDisplay {
  icon: string;
  label: string;
}

/** Shown for a provider id this file does not know. */
export const SOCIAL_PROVIDER_FALLBACK_ICON = 'i-lucide-log-in';

/**
 * The providers Better Auth ships, by the id the API configures them under.
 *
 * Icons come from `@iconify-json/lucide`, the only collection the template installs. Lucide keeps
 * a few brand marks as deprecated icons; where it has none, the button shows the neutral icon.
 * `tests/unit/utils/social-sign-in.test.ts` checks every name against the installed collection,
 * so an update that drops one fails there instead of rendering an empty icon.
 */
const KNOWN_PROVIDERS: Record<string, SocialProviderDisplay> = {
  apple: { icon: 'i-lucide-apple', label: 'Apple' },
  atlassian: { icon: SOCIAL_PROVIDER_FALLBACK_ICON, label: 'Atlassian' },
  cognito: { icon: SOCIAL_PROVIDER_FALLBACK_ICON, label: 'Amazon Cognito' },
  discord: { icon: SOCIAL_PROVIDER_FALLBACK_ICON, label: 'Discord' },
  dropbox: { icon: SOCIAL_PROVIDER_FALLBACK_ICON, label: 'Dropbox' },
  facebook: { icon: 'i-lucide-facebook', label: 'Facebook' },
  figma: { icon: 'i-lucide-figma', label: 'Figma' },
  github: { icon: 'i-lucide-github', label: 'GitHub' },
  gitlab: { icon: 'i-lucide-gitlab', label: 'GitLab' },
  google: { icon: SOCIAL_PROVIDER_FALLBACK_ICON, label: 'Google' },
  huggingface: { icon: SOCIAL_PROVIDER_FALLBACK_ICON, label: 'Hugging Face' },
  linear: { icon: SOCIAL_PROVIDER_FALLBACK_ICON, label: 'Linear' },
  linkedin: { icon: 'i-lucide-linkedin', label: 'LinkedIn' },
  // Four squares, the shape of Microsoft's logo.
  microsoft: { icon: 'i-lucide-grid-2x2', label: 'Microsoft' },
  notion: { icon: SOCIAL_PROVIDER_FALLBACK_ICON, label: 'Notion' },
  paypal: { icon: SOCIAL_PROVIDER_FALLBACK_ICON, label: 'PayPal' },
  reddit: { icon: SOCIAL_PROVIDER_FALLBACK_ICON, label: 'Reddit' },
  salesforce: { icon: SOCIAL_PROVIDER_FALLBACK_ICON, label: 'Salesforce' },
  slack: { icon: 'i-lucide-slack', label: 'Slack' },
  spotify: { icon: SOCIAL_PROVIDER_FALLBACK_ICON, label: 'Spotify' },
  tiktok: { icon: SOCIAL_PROVIDER_FALLBACK_ICON, label: 'TikTok' },
  twitch: { icon: 'i-lucide-twitch', label: 'Twitch' },
  twitter: { icon: 'i-lucide-twitter', label: 'X' },
  vercel: { icon: SOCIAL_PROVIDER_FALLBACK_ICON, label: 'Vercel' },
  zoom: { icon: SOCIAL_PROVIDER_FALLBACK_ICON, label: 'Zoom' },
};

/** Label and icon for a provider's button; an unknown id gets its own name, capitalised. */
export function socialProviderDisplay(id: string): SocialProviderDisplay {
  const known = Object.hasOwn(KNOWN_PROVIDERS, id) ? KNOWN_PROVIDERS[id] : undefined;
  if (known) {
    return known;
  }
  return { icon: SOCIAL_PROVIDER_FALLBACK_ICON, label: id.charAt(0).toUpperCase() + id.slice(1) };
}

/** Every icon name this file can hand out, for the check against the installed collection. */
export function socialProviderIcons(): string[] {
  return [...new Set([SOCIAL_PROVIDER_FALLBACK_ICON, ...Object.values(KNOWN_PROVIDERS).map((provider) => provider.icon)])];
}

/** The provider ids `/iam/features` lists, as `useLtAuth().features` holds them; nothing else. */
export function socialProvidersOf(features: unknown): string[] {
  const listed = (features as null | undefined | { socialProviders?: unknown })?.socialProviders;
  if (!Array.isArray(listed)) {
    return [];
  }
  return [...new Set(listed.filter((id): id is string => typeof id === 'string' && id.trim() !== '').map((id) => id.trim()))];
}

/**
 * The provider id the project configured for the silent attempt, or null while the setting is off.
 *
 * `configured` is `runtimeConfig.public.authSilentProvider` (`NUXT_PUBLIC_AUTH_SILENT_PROVIDER`),
 * typed `unknown` because Nitro applies `NUXT_PUBLIC_*` through `destr()` (see `app-origin.ts`).
 * Empty, the default, means off. Known on the server too, so the login page renders its first paint
 * from it: the checking state instead of the form while the setting is on.
 */
export function configuredSilentProvider(configured: unknown): null | string {
  const id = typeof configured === 'string' ? configured.trim() : '';
  return id || null;
}

/** The provider for the silent attempt: the configured one (`configuredSilentProvider`), and only while the API lists it. */
export function silentSignInProvider(configured: unknown, providers: readonly string[]): null | string {
  const id = configuredSilentProvider(configured);
  return id && providers.includes(id) ? id : null;
}

/**
 * How long the login page waits for `/iam/features` before it gives up the silent attempt and shows
 * the form, in milliseconds.
 *
 * With the setting on, the page opens with "Anmeldung wird geprüft …" and needs the provider list to
 * start the attempt. A failed request shows the form at once; this covers an API that is slow or does
 * not answer, so nobody stays on the checking state. Three seconds is several times a healthy answer
 * after the page has mounted (measured: about 0.5 s warm, 2.8 s cold in `nuxt dev`, both counted from
 * the first paint, which includes loading the page's scripts), and short enough to wait through.
 * Features that arrive later start no attempt: the visitor may be typing by then.
 */
export const SILENT_SIGN_IN_FEATURES_TIMEOUT_MS = 3000;

// ============================================================================
// Marks of the silent attempt
// ============================================================================

/**
 * Remembers what the silent attempt must not repeat.
 *
 * - **Attempted**, per tab, in `sessionStorage`. Set before the attempt starts. Without a provider
 *   session the provider sends the browser back to the login page, which would otherwise start the
 *   next attempt: a loop. A new tab may try once of its own.
 * - **Signed out**, for every tab of this browser, in `localStorage`. Set on an explicit sign-out.
 *   The provider session outlives the app's, so a silent attempt after it would sign the visitor
 *   straight back in, and not only in the tab that signed out: measured while this mark was per tab,
 *   a new tab of the same browser sent `prompt=none` within four seconds of "Abmelden" and was in the
 *   app again. `localStorage` is shared by every tab of the origin and survives closing them.
 *
 * Every completed sign-in clears both, in both stores (password and passkey on `login.vue`, the second
 * factor on `2fa.vue`, a provider on `callback.vue` once the auth state is stored where the route
 * guard reads it), so a later visit without a session, after the session expired, may try again.
 *
 * Both stores are per origin, so two apps on different origins cannot share the marks. The keys are
 * fixed, with a prefix of their own. Fail closed: when either store is missing, blocked or throws, no
 * silent attempt runs.
 */
export interface SocialSignInMarks {
  /**
   * Clears both marks from both stores, a "signed out" mark an earlier version of this file left in
   * `sessionStorage` included. Each removal on its own, so one blocked store does not keep the other's.
   */
  clear(): void;
  /** Sets the "signed out" mark for every tab. False when `localStorage` refused the write. */
  markSignedOut(): boolean;
  /**
   * Sets the "attempted" mark. False when storage refused the write; the attempt must not start
   * then, because nothing would stop the next one.
   */
  markSilentAttempt(): boolean;
  /** True while both stores work and no mark is set. A missing, blocked or throwing store: false. */
  maySignInSilently(): boolean;
}

/** The `sessionStorage` key of the "attempted" mark. */
export const SILENT_ATTEMPTED_KEY = 'lt-social-sign-in:silent-attempted';

/**
 * The `localStorage` key of the "signed out" mark. An earlier version kept it under the same key in
 * `sessionStorage`; there it still counts for its tab, and `clear()` removes it.
 */
export const SIGNED_OUT_KEY = 'lt-social-sign-in:signed-out';

/** The store, or null where there is none (SSR) or its accessor throws (blocked: private modes, site settings). */
function browserStorage(name: 'localStorage' | 'sessionStorage'): null | Storage {
  try {
    return typeof window === 'undefined' ? null : (window[name] ?? null);
  } catch {
    return null;
  }
}

/** The marks of the silent attempt. Every method fails safely when storage is blocked. */
export const socialSignInMarks: SocialSignInMarks = {
  clear() {
    for (const name of ['sessionStorage', 'localStorage'] as const) {
      for (const key of [SILENT_ATTEMPTED_KEY, SIGNED_OUT_KEY]) {
        try {
          browserStorage(name)?.removeItem(key);
        } catch {
          // Blocked storage holds no marks.
        }
      }
    }
  },
  markSignedOut() {
    try {
      const shared = browserStorage('localStorage');
      shared?.setItem(SIGNED_OUT_KEY, '1');
      return shared?.getItem(SIGNED_OUT_KEY) === '1';
    } catch {
      return false;
    }
  },
  markSilentAttempt() {
    try {
      const tab = browserStorage('sessionStorage');
      tab?.setItem(SILENT_ATTEMPTED_KEY, '1');
      return tab?.getItem(SILENT_ATTEMPTED_KEY) === '1';
    } catch {
      return false;
    }
  },
  maySignInSilently() {
    try {
      const tab = browserStorage('sessionStorage');
      const shared = browserStorage('localStorage');
      return !!tab && !!shared && tab.getItem(SILENT_ATTEMPTED_KEY) === null && tab.getItem(SIGNED_OUT_KEY) === null && shared.getItem(SIGNED_OUT_KEY) === null;
    } catch {
      return false;
    }
  },
};

// ============================================================================
// ?error= on the way back
// ============================================================================

/** The code `callback.vue` sends to the login page when the provider's callback left no session, or the app could not store the auth state. */
export const SOCIAL_SIGN_IN_NO_SESSION = 'session_missing';

/** What the login page shows for an `?error=` it was reached with. */
export interface SocialSignInError {
  description: string;
  title: string;
}

/**
 * The silent attempt would have needed a page at the provider: nothing to say, the form simply appears.
 *
 * With `prompt=none` the provider answers instead of showing its sign-in (`login_required`), any other
 * prompt (`interaction_required`), its consent screen (`consent_required`: a user with a provider
 * session who has not consented to the app yet, for example every user of a tenant without admin
 * consent) or its account picker (`account_selection_required`); OpenID Connect Core 1.0, 3.1.2.6.
 * One click on the provider button (`prompt=select_account`) shows that page and signs the user in.
 * An interactive sign-in never answers these codes, so none of them is a refusal.
 */
const SILENT_MISS = new Set(['account_selection_required', 'consent_required', 'interaction_required', 'login_required']);

/** The provider or Better Auth refused this account. */
const REFUSED: SocialSignInError = {
  description: 'Dieses Konto ist für diese Anwendung nicht freigeschaltet. Bitte wende dich an deine Administration oder melde dich mit einem anderen Konto an.',
  title: 'Kein Zugang',
};

/**
 * Better Auth found an account with the provider's e-mail address that signs in another way (a local
 * account with a password, for example) and links the two only for trusted providers. Measured with a
 * local account and a Microsoft account of the same address.
 */
const NOT_LINKED: SocialSignInError = {
  description: 'Für diese E-Mail-Adresse gibt es bereits ein Konto mit einer anderen Anmeldeart. Bitte melde dich wie bisher an oder wende dich an die Administration.',
  title: 'Anmeldung nicht möglich',
};

/**
 * The API's callback could not read the state of the sign-in: it took longer than the state lives
 * (ten minutes), or the callback was opened twice. nest-server sends these to the login page instead
 * of Better Auth's error page on the API host, WITHOUT `redirect`, because the state that carried it
 * is gone; the page falls back to `/app`.
 */
const INTERRUPTED: SocialSignInError = {
  description: 'Die Anmeldung hat zu lange gedauert oder wurde unterbrochen. Bitte starte sie erneut.',
  title: 'Anmeldung abgebrochen',
};

/** Codes with a message of their own; everything else gets the generic message. */
const MESSAGES: Record<string, SocialSignInError> = {
  access_denied: REFUSED,
  account_not_linked: NOT_LINKED,
  please_restart_the_process: INTERRUPTED,
  signup_disabled: REFUSED,
  state_mismatch: INTERRUPTED,
  state_not_found: INTERRUPTED,
  unauthorized_client: REFUSED,
};

/**
 * The shape of a code, so the generic message can name it for support. Anything else in `error`
 * was not written by the provider or Better Auth, and is not shown.
 */
const CODE_SHAPE = /^[A-Za-z0-9_]{1,64}$/;

/**
 * The message for the `error` query value the login page was reached with, or null for none.
 *
 * Only the code is read, and only a fixed text is returned. Never render `error_description` or
 * any other query value: anybody can write a link to the login page with a text of their choice,
 * and the page would show it in its own voice.
 */
export function socialSignInError(code: unknown): null | SocialSignInError {
  if (code === undefined || code === null || code === '') {
    return null;
  }
  const value = typeof code === 'string' ? code.trim() : '';
  const known = value.toLowerCase();
  if (SILENT_MISS.has(known)) {
    return null;
  }
  if (Object.hasOwn(MESSAGES, known)) {
    return MESSAGES[known] ?? null;
  }
  return {
    description: CODE_SHAPE.test(value)
      ? `Die Anmeldung wurde nicht abgeschlossen (Fehlercode: ${value}). Bitte versuche es erneut.`
      : 'Die Anmeldung wurde nicht abgeschlossen. Bitte versuche es erneut.',
    title: 'Anmeldung fehlgeschlagen',
  };
}

/** True when the query carries what the provider or Better Auth appended on the way back. */
export function hasSignInError(query: Record<string, unknown>): boolean {
  return 'error' in query || 'error_description' in query;
}

/**
 * The query without `error` and `error_description`, everything else kept (`redirect` above all).
 *
 * The login page reads the code once and then replaces the URL with this, so a reload does not bring
 * back a stale message and the code does not stay in the history.
 */
export function withoutSignInError<T>(query: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(query).filter(([name]) => name !== 'error' && name !== 'error_description'));
}

/**
 * The query without `error_description`, everything else kept (`error` and `redirect` above all).
 *
 * `app/middleware/sign-in-error-text.global.ts` redirects to this before the login page renders.
 * Microsoft puts a long text with trace and correlation ids there; rendered, it would be in the HTML
 * and the SSR payload, in the address bar and the history, and within reach of analytics and the bug
 * reporter.
 */
export function withoutProviderErrorText<T>(query: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(query).filter(([name]) => name !== 'error_description'));
}
