<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';
import type { InferOutput } from 'valibot';

import type { SocialSignInError } from '~/utils/social-sign-in';

import * as v from 'valibot';

// ============================================================================
// Types
// ============================================================================
interface SignInResponse {
  data?: {
    redirect?: boolean;
    requiresTwoFactor?: boolean;
    token?: string | null;
    twoFactorRedirect?: boolean;
    url?: string;
    user?: Record<string, unknown>;
  } | null;
  error?: {
    code?: string;
    message?: string;
    status?: number;
  } | null;
}

// ============================================================================
// Composables
// ============================================================================
const toast = useToast();
const { signIn, setUser, validateSession, authenticateWithPasskey, features, fetchFeatures } = useLtAuth();
const { translateError } = useLtErrorTranslation();
const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();

// ============================================================================
// Computed
// ============================================================================
/**
 * Where to go once the whole sign-in flow completes.
 *
 * `auth.global` sends an unauthenticated visitor to
 * `/auth/login?redirect=<the page they wanted>`. Signing in through this form used to
 * navigate to `/app` unconditionally, so the target was dropped and every deep link
 * died at the login step: a link shared in a chat or an e-mail dumped the recipient
 * on the dashboard, and they had to find the record by hand.
 *
 * Validation lives in `safeRedirectTarget` (auto-imported from `app/utils/`) so that
 * this page, `2fa.vue` and `guest.global` all apply the SAME rule — they previously
 * did not.
 */
const redirectTarget = computed(() => safeRedirectTarget(route.query.redirect));

/**
 * The redirect carried into an INTERMEDIATE auth step (2FA, e-mail verification).
 *
 * Those pages finish the sign-in and do the final navigation themselves, so the
 * target has to survive the detour — otherwise the deep link dies one step later
 * than it used to, which is harder to notice, not easier. Empty when the visitor
 * came to the login page directly, so no pointless `?redirect=/app` is appended.
 */
const redirectQuery = computed(() => (typeof route.query.redirect === 'string' ? { redirect: redirectTarget.value } : {}));

/** True once `/iam/features` has answered in the browser: it starts empty on the client and fills with the answer. */
const featuresArrived = computed(() => Object.keys(features.value ?? {}).length > 0);

/**
 * What `/iam/features` answered the server, for the first render: `useLtAuth()` fetches the features on the
 * client only, so without it a provider-only API would get the form in the server HTML, and it would vanish
 * after load (the provider buttons, the other way round, would appear). The state reaches the browser in
 * the payload, so its first render matches the server's. `null` when the request failed: the page renders as
 * before.
 *
 * Kept apart from `useLtAuth().features` on purpose. Stored there (`fetchFeatures()`), it would also mark
 * the features as fetched, and the browser would never ask again: the page would then rely on an answer
 * the server got, and the silent attempt and `tests/e2e/auth-social-sign-in.spec.ts`, which answers
 * `/iam/features` in the browser, would no longer see the browser's answer. A top-level `await`, as in
 * `register.vue`; in `onServerPrefetch` a call after the first `await` runs without the Nuxt instance, and
 * `nuxt dev` logs NUXT_E1001 on every server render (measured 2026-11-25).
 */
const serverFeatures = useState<null | Record<string, unknown>>('login-server-features', () => null);
if (import.meta.server) {
  try {
    serverFeatures.value = await $fetch<Record<string, unknown>>(`${getLtApiBase()}/features`);
  } catch {
    serverFeatures.value = null;
  }
}

/** The features the sign-in methods follow: the browser's answer once it is there, the server's until then. */
const signInFeatures = computed<Record<string, unknown>>(() => (featuresArrived.value ? features.value : (serverFeatures.value ?? {})));

/** One button per provider the API lists in `/iam/features` (see `app/utils/social-sign-in.ts`). */
const socialButtons = computed(() => socialProvidersOf(signInFeatures.value).map((id) => ({ id, ...socialProviderDisplay(id) })));

/**
 * The provider for the silent attempt: `NUXT_PUBLIC_AUTH_SILENT_PROVIDER`, while the API lists it. From the
 * browser's answer only: the attempt is decided after mount (see `silentPhase`).
 */
const silentProvider = computed(() => silentSignInProvider(config.public.authSilentProvider, socialProvidersOf(features.value)));

/**
 * Sign-in with e-mail and password: off only when the API says so (`emailAndPassword: false`, nest-server
 * 12.11.0+, an API that signs in through providers alone). Without the field, from an older API or before
 * `/iam/features` answered, the form stays. "Passwort vergessen?" and "Registrieren" go with it: both lead to
 * pages that only work with a password.
 */
const passwordSignIn = computed(() => signInFeatures.value.emailAndPassword !== false);

/** The passkey button, unless the API reports passkeys off (as nest-server 12.11.0+ does for provider-only sign-in). */
const passkeySignIn = computed(() => signInFeatures.value.passkey !== false);

/** Nothing left to sign in with: the page says so instead of showing an empty card. */
const noSignInMethod = computed(() => !passwordSignIn.value && !passkeySignIn.value && socialButtons.value.length === 0);

// ============================================================================
// Page Meta
// ============================================================================
definePageMeta({
  layout: 'slim',
});

useHead({
  title: 'Anmeldung',
});

// ============================================================================
// Variables
// ============================================================================
const loading = ref<boolean>(false);
const passkeyLoading = ref<boolean>(false);
/** The provider whose sign-in is starting; its button spins, the others wait. */
const socialLoading = ref<null | string>(null);

/**
 * Why the provider or Better Auth sent the browser back here (`?error=` on `errorCallbackURL`).
 *
 * Read ONCE into state: on mount the URL loses `error` (see `withoutSignInError`), and the message
 * stays until the user starts a new sign-in. Only the code is mapped. `error_description` never
 * gets here: `sign-in-error-text.global.ts` redirects it out of the URL before the page renders.
 */
const socialError = ref<null | SocialSignInError>(socialSignInError(route.query.error));

/** Reached with an `error`: the silent attempt never starts then, or it would loop. */
const arrivedWithError = hasSignInError(route.query);

/**
 * Where the silent attempt stands: `waiting` until the page knows whether it runs, `running` while
 * it does, `off` for the form.
 *
 * With `NUXT_PUBLIC_AUTH_SILENT_PROVIDER` set and no `error` in the URL, the page starts in
 * `waiting`, on the server too: both know the runtime config and the query, so the server and the
 * client's first render show the same checking state and hydration matches. What the server cannot
 * know (the marks in browser storage, the provider list) is decided after mount, and every way that
 * rules the attempt out ends in `off`: a mark, blocked storage, a list without the provider, a failed
 * `/iam/features`, or no answer within `SILENT_SIGN_IN_FEATURES_TIMEOUT_MS`.
 */
const silentPhase = ref<'off' | 'running' | 'waiting'>(configuredSilentProvider(config.public.authSilentProvider) && !arrivedWithError ? 'waiting' : 'off');

/** The form is hidden behind "Anmeldung wird geprüft …" while the attempt waits or runs. */
const silentChecking = computed(() => silentPhase.value !== 'off');

/** The fallback timer of the `waiting` phase. */
let silentWaitTimer: ReturnType<typeof setTimeout> | undefined;

/** No silent attempt in this page view: the form takes over. A running attempt is left alone. */
function stopWaitingForSilentSignIn(): void {
  clearTimeout(silentWaitTimer);
  if (silentPhase.value === 'waiting') {
    silentPhase.value = 'off';
  }
}

/**
 * Parameters of a sign-in through `provider`.
 *
 * Both URLs are absolute app URLs: Better Auth resolves a relative one against the API origin.
 * They are built from the app origin, a fixed path and the validated deep-link target, never from
 * raw query input. Better Auth appends `?error=` to `errorCallbackURL`.
 */
function socialSignInParams(provider: string, prompt: 'none' | 'select_account') {
  const redirect = encodeURIComponent(redirectTarget.value);
  return {
    additionalParams: { prompt },
    callbackURL: appUrl(`/auth/callback?redirect=${redirect}`, config.public.siteUrl),
    errorCallbackURL: appUrl(`/auth/login?redirect=${redirect}`, config.public.siteUrl),
    provider,
  };
}

/**
 * Interactive sign-in: `prompt=select_account` lets the user pick or switch the account at the
 * provider. On success the browser leaves for the provider, so the button keeps spinning.
 */
async function onSocialSignIn(provider: string): Promise<void> {
  socialError.value = null;
  socialLoading.value = provider;

  try {
    const result = (await signIn.social(socialSignInParams(provider, 'select_account'))) as SignInResponse;
    if (result?.error) {
      socialLoading.value = null;
      toast.add({
        color: 'error',
        description: result.error.message ? translateError(result.error.message) : 'Die Anmeldung ist gerade nicht möglich. Bitte versuche es später erneut.',
        title: 'Anmeldung fehlgeschlagen',
      });
    }
  } catch {
    socialLoading.value = null;
    toast.add({
      color: 'error',
      description: 'Ein unerwarteter Fehler ist aufgetreten',
      title: 'Fehler',
    });
  }
}

/**
 * Silent sign-in: `prompt=none` makes the provider answer without showing anything, signed in when
 * the visitor has a session there, otherwise back here with `?error=login_required` (or another code
 * that means a page would be needed at the provider). It starts only from `waiting` (never with an
 * `error` in the URL, never after the page gave up waiting). The marks allow it once per tab, and
 * after "Abmelden" in no tab of this browser until the next completed sign-in
 * (`app/utils/social-sign-in.ts`); the "attempted" mark is set before the request, and without it
 * the attempt does not start.
 */
async function startSilentSignIn(provider: string): Promise<void> {
  if (silentPhase.value !== 'waiting') {
    return;
  }
  if (!socialSignInMarks.maySignInSilently() || !socialSignInMarks.markSilentAttempt()) {
    stopWaitingForSilentSignIn();
    return;
  }
  clearTimeout(silentWaitTimer);
  silentPhase.value = 'running';

  try {
    const result = (await signIn.social(socialSignInParams(provider, 'none'))) as SignInResponse;
    if (result?.error) {
      silentPhase.value = 'off';
    }
  } catch {
    // Nothing to tell the visitor, who did not ask for this attempt; the form takes over.
    silentPhase.value = 'off';
  }
}

/**
 * Decides after mount whether the silent attempt runs; the server rendered `waiting` without knowing.
 *
 * The tab's marks and storage are known at once. The provider list arrives with `/iam/features`:
 * listing the provider starts the attempt, anything else shows the form. `fetchFeatures()` resolves
 * with the list unchanged when the request failed, so a failure shows the form at once instead of
 * after the timeout; the timeout covers an API that does not answer.
 */
function decideSilentSignIn(): void {
  if (!socialSignInMarks.maySignInSilently()) {
    stopWaitingForSilentSignIn();
    return;
  }

  silentWaitTimer = setTimeout(stopWaitingForSilentSignIn, SILENT_SIGN_IN_FEATURES_TIMEOUT_MS);

  watch(
    [silentProvider, featuresArrived],
    ([provider, arrived]) => {
      if (provider) {
        void startSilentSignIn(provider);
      } else if (arrived) {
        // The API answered and does not list the provider.
        stopWaitingForSilentSignIn();
      }
    },
    { immediate: true },
  );

  if (silentPhase.value === 'waiting' && !featuresArrived.value) {
    void fetchFeatures()
      .catch(() => undefined)
      .then(() => {
        if (!featuresArrived.value) {
          stopWaitingForSilentSignIn();
        }
      });
  }
}

/** Back from the provider via the back/forward cache: the page is restored with a spinner that never ends. */
function onPageShow(event: PageTransitionEvent): void {
  if (event.persisted) {
    socialLoading.value = null;
    clearTimeout(silentWaitTimer);
    silentPhase.value = 'off';
  }
}

const fields: AuthFormField[] = [
  {
    // `username`, not `email`: it pairs this field with the password for the password manager.
    // `type: 'email'` keeps validation and the keyboard (DEV-3147).
    autocomplete: 'username',
    label: 'E-Mail',
    name: 'email',
    placeholder: 'E-Mail eingeben',
    required: true,
    type: 'email',
  },
  {
    autocomplete: 'current-password',
    label: 'Passwort',
    name: 'password',
    placeholder: 'Passwort eingeben',
    required: true,
    type: 'password',
  },
];

const schema = v.object({
  email: v.pipe(v.string('E-Mail ist erforderlich'), v.email('Bitte eine gültige E-Mail eingeben')),
  password: v.pipe(v.string('Passwort ist erforderlich'), v.minLength(5, 'Mindestens 5 Zeichen erforderlich')),
});

type Schema = InferOutput<typeof schema>;

/**
 * Handle passkey authentication
 * Uses authenticateWithPasskey from composable which supports JWT mode (challengeId)
 */
async function onPasskeyLogin(): Promise<void> {
  socialError.value = null;
  passkeyLoading.value = true;

  try {
    // Use composable method which handles challengeId for JWT mode
    const result = await authenticateWithPasskey();

    // Check for error in response (authenticateWithPasskey returns { success, error?, user? })
    if (!result.success) {
      toast.add({
        color: 'error',
        description: result.error || 'Passkey-Anmeldung fehlgeschlagen',
        title: 'Fehler',
      });
      return;
    }

    // Update auth state with user data if available
    if (result.user) {
      setUser(result.user);
    } else {
      // Passkey auth may return success without user - fetch user via session validation
      await validateSession();
    }

    // Signed in: a later visit after the session expired may try the silent sign-in again.
    socialSignInMarks.clear();
    await navigateTo(redirectTarget.value);
  } catch (err: unknown) {
    // Handle WebAuthn-specific errors
    if (err instanceof Error && err.name === 'NotAllowedError') {
      toast.add({
        color: 'error',
        description: 'Passkey-Authentifizierung wurde abgebrochen',
        title: 'Fehler',
      });
      return;
    }
    toast.add({
      color: 'error',
      description: err instanceof Error ? err.message : 'Passkey-Anmeldung fehlgeschlagen',
      title: 'Fehler',
    });
  } finally {
    passkeyLoading.value = false;
  }
}

// ============================================================================
// Race-safe submit guard (capture-phase preventDefault)
// ============================================================================
// Vue's `<UAuthForm>` handler calls `event.preventDefault()` inside its bubble
// listener — but that listener is attached during per-component hydration. If a
// user (or an automated/MCP test) submits the form BEFORE this listener has
// attached, the browser performs the native form GET — leaking the password
// into the URL. This capture-phase listener attaches as soon as the wrapper
// mounts and unconditionally prevents the default, closing that race window.
// Vue's own bubble handler still runs once attached and performs the real sign-in.
const formRoot = ref<HTMLElement | null>(null);
onMounted(() => {
  const form = formRoot.value?.querySelector?.('form');
  if (form instanceof HTMLFormElement) {
    form.addEventListener('submit', (event) => event.preventDefault(), { capture: true });
  }
});

// ============================================================================
// Sign-in through a social provider: clean URL, silent attempt
// ============================================================================
onMounted(() => {
  window.addEventListener('pageshow', onPageShow);

  // The code is in `socialError` now, so it leaves the URL too: a reload must not bring the message
  // back. `sign-in-error-text.global.ts` removed `error_description` before the page rendered;
  // `redirect` and every other parameter stay.
  if (arrivedWithError) {
    void router.replace({ hash: route.hash, query: withoutSignInError(route.query) });
  }

  // `/iam/features` arrives after the start, so the attempt waits for the provider list.
  if (silentPhase.value === 'waiting') {
    decideSilentSignIn();
  }
});

onUnmounted(() => {
  window.removeEventListener('pageshow', onPageShow);
  clearTimeout(silentWaitTimer);
});

// ============================================================================
// Functions
// ============================================================================
async function onSubmit(payload: FormSubmitEvent<Schema>): Promise<void> {
  socialError.value = null;
  loading.value = true;

  try {
    const result = (await signIn.email({
      email: payload.data.email,
      password: payload.data.password,
    })) as SignInResponse;

    // Check for error in response
    if (result.error) {
      const errorMessage = result.error.message;

      // Check if email verification is required → redirect to verify-email page
      if (errorMessage && (errorMessage.includes('LTNS_0023') || errorMessage.toLowerCase().includes('email verification required'))) {
        toast.add({
          color: 'warning',
          description: 'Bitte bestätige zuerst deine E-Mail-Adresse.',
          title: 'E-Mail nicht verifiziert',
        });
        // `redirectQuery` keeps the deep link alive across the verification detour. The address goes
        // in the history entry, never in the URL (see `app/utils/verify-email-memory.ts`).
        await navigateTo({ path: '/auth/verify-email', query: redirectQuery.value, state: verifyEmailState(payload.data.email) });
        return;
      }

      toast.add({
        color: 'error',
        // No message means the request itself failed (API down, proxy 5xx). Falling back to the
        // title text made the toast, and a screen reader, say the same line twice.
        description: errorMessage ? translateError(errorMessage) : 'Die Anmeldung ist gerade nicht möglich. Bitte versuche es später erneut.',
        title: 'Anmeldung fehlgeschlagen',
      });
      return;
    }

    // Check if 2FA is required
    // Better-Auth native uses 'twoFactorRedirect', nest-server REST API uses 'requiresTwoFactor'
    const resultData = result.data as Record<string, unknown> | null | undefined;
    const requires2FA = resultData && (resultData.twoFactorRedirect || resultData.requiresTwoFactor || resultData.redirect);
    if (requires2FA) {
      // Redirect to 2FA page, carrying the deep-link target: `2fa.vue` performs the
      // final navigation, so dropping the query here would strand every 2FA user on
      // the dashboard — the exact bug this flow's redirect handling exists to fix.
      await navigateTo({ path: '/auth/2fa', query: redirectQuery.value });
      return;
    }

    // Check if login was successful (user data in response)
    const userData = result.data?.user;
    if (userData) {
      // Auth state is already stored by useLtAuth. Signed in: a later visit after the session
      // expired may try the silent sign-in again.
      socialSignInMarks.clear();
      await navigateTo(redirectTarget.value);
    } else {
      toast.add({
        color: 'error',
        description: 'Anmeldung fehlgeschlagen - keine Benutzerdaten erhalten',
        title: 'Fehler',
      });
    }
  } catch (err) {
    toast.add({
      color: 'error',
      description: 'Ein unerwarteter Fehler ist aufgetreten',
      title: 'Fehler',
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UPageCard class="w-md" variant="naked">
    <!-- Always in the DOM, so screen readers announce the text when it appears. -->
    <p role="status" :class="silentChecking ? 'text-center text-muted' : 'sr-only'">{{ silentChecking ? 'Anmeldung wird geprüft …' : '' }}</p>
    <div v-show="!silentChecking" ref="formRoot">
      <!-- role="alert": `callback.vue` comes here by a client-side navigation, so neither focus nor the title change; the role is what announces the failure. -->
      <UAlert
        v-if="socialError"
        role="alert"
        color="error"
        variant="subtle"
        icon="i-lucide-shield-alert"
        :title="socialError.title"
        :description="socialError.description"
        class="mb-4"
      />
      <!-- Without fields, UAuthForm renders no form and no submit button: header and footer stay. -->
      <UAuthForm
        :schema="schema"
        title="Anmelden"
        icon="i-lucide-user"
        :fields="passwordSignIn ? fields : []"
        :loading="loading"
        :submit="{
          label: 'Anmelden',
          block: true,
        }"
        @submit="onSubmit"
      >
        <template #title>
          <h1 class="text-2xl font-bold">Anmelden</h1>
        </template>

        <template #password-hint>
          <ULink to="/auth/forgot-password" class="text-primary font-medium">Passwort vergessen?</ULink>
        </template>

        <template #footer>
          <div class="flex flex-col gap-4">
            <USeparator v-if="passwordSignIn && (passkeySignIn || socialButtons.length > 0)" label="oder" />

            <UButton
              v-for="provider in socialButtons"
              :key="provider.id"
              block
              color="neutral"
              variant="outline"
              :icon="provider.icon"
              :loading="socialLoading === provider.id"
              :disabled="socialLoading !== null && socialLoading !== provider.id"
              @click="onSocialSignIn(provider.id)"
            >
              Mit {{ provider.label }} anmelden
            </UButton>

            <UButton v-if="passkeySignIn" block color="neutral" variant="outline" icon="i-lucide-key" :loading="passkeyLoading" @click="onPasskeyLogin">
              Mit Passkey anmelden
            </UButton>

            <UAlert
              v-if="noSignInMethod"
              color="warning"
              variant="subtle"
              icon="i-lucide-circle-alert"
              title="Anmeldung nicht möglich"
              description="Für diese Anwendung ist derzeit keine Anmeldemethode eingerichtet. Bitte wende dich an die Betreiber der Anwendung."
            />

            <p v-if="passwordSignIn && signInFeatures.signUpEnabled !== false" class="text-center text-sm text-muted">
              Noch kein Konto?
              <ULink to="/auth/register" class="text-primary font-medium">Registrieren</ULink>
            </p>
          </div>
        </template>
      </UAuthForm>
    </div>
  </UPageCard>
</template>
