<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';
import type { InferOutput } from 'valibot';

import * as v from 'valibot';

// Auth client from @lenne.tech/nuxt-extensions
const authClient = useLtAuthClient();

// ============================================================================
// Composables
// ============================================================================
const route = useRoute();
const router = useRouter();
const { translateError } = useLtErrorTranslation();

// ============================================================================
// Page Meta
// ============================================================================
definePageMeta({
  layout: 'slim',
});

useHead({
  title: 'Passwort zurücksetzen',
});

// Server only: on the client the head would run it again after mount, on the arrival that has just
// stored the link, and erase that.
if (import.meta.server) {
  useHead({ script: [{ innerHTML: ERASE_RESET_LINK_SCRIPT }] });
}

// ============================================================================
// Variables
// ============================================================================
/**
 * Read once into a ref rather than a computed over `route.query`.
 *
 * `onMounted` strips the token from the URL (see below), which would empty a computed
 * and take the form with it. Reading synchronously also keeps SSR and the first client
 * render in agreement — a computed that resolves after mount would render the "invalid
 * link" state first and then flip.
 */
const token = ref<string>(typeof route.query.token === 'string' ? route.query.token : '');

const isTokenValid = computed<boolean>(() => token.value.length > 0);
const loading = ref<boolean>(false);
const resetSuccess = ref<boolean>(false);

/**
 * Errors that concern the LINK or the SYSTEM, shown as a persistent alert.
 *
 * Deliberately not a toast. Without Better-Auth's redirect hop — nest-server links straight
 * to this page by default — submitting is the ONLY moment anyone learns their link is dead.
 * A message that disappears after a few seconds, while the reader is still looking at a
 * password field, is barely better than none.
 */
const submitError = ref<string>('');

/** Whether {@link submitError} means "get a new link" or "try again later". */
const submitErrorKind = ref<'link' | 'system'>('system');

/** Errors that concern the INPUT, shown at the field where the correction happens. */
const passwordError = ref<string>('');

const successHeading = ref<HTMLElement | null>(null);

const fields: AuthFormField[] = [
  {
    autocomplete: 'new-password',
    label: 'Neues Passwort',
    name: 'password',
    placeholder: 'Neues Passwort eingeben',
    required: true,
    type: 'password',
  },
  {
    autocomplete: 'new-password',
    label: 'Passwort bestätigen',
    name: 'confirmPassword',
    placeholder: 'Passwort wiederholen',
    required: true,
    type: 'password',
  },
];

/**
 * `minLength(8)` is NOT cosmetic — it is the only length check that exists.
 *
 * `useLtAuthClient().resetPassword` runs `ltSha256` over the password before anything
 * leaves the browser, so Better-Auth always receives a 64-character hex digest. Its own
 * `minPasswordLength` therefore compares against 64 and passes unconditionally, whatever
 * the user typed. Weaken or remove this rule and there is no server-side backstop — and
 * nothing fails, which is what makes it dangerous.
 *
 * By the same mechanism `maxPasswordLength` (128 by default) can never be exceeded, so a
 * generated passphrase of any length is fine. Do NOT add an upper bound here: it would
 * reject passwords the server accepts happily.
 */
const schema = v.pipe(
  v.object({
    confirmPassword: v.pipe(v.string('Passwortbestätigung ist erforderlich'), v.minLength(8, 'Mindestens 8 Zeichen erforderlich')),
    password: v.pipe(v.string('Passwort ist erforderlich'), v.minLength(8, 'Mindestens 8 Zeichen erforderlich')),
  }),
  v.forward(
    v.partialCheck([['password'], ['confirmPassword']], (input) => input.password === input.confirmPassword, 'Passwörter stimmen nicht überein'),
    ['confirmPassword'],
  ),
);

type Schema = InferOutput<typeof schema>;

// ============================================================================
// Error classification
// ============================================================================
/**
 * Better-Auth answers `POST /reset-password` with FIVE different failures under ONE status
 * code (400): `INVALID_TOKEN` twice, `PASSWORD_TOO_SHORT`, `PASSWORD_TOO_LONG` and
 * `USER_NOT_FOUND`. Branching on the status is therefore impossible — the `code` is the only
 * thing that separates "your link is dead" from "your input is wrong" from "we are having a
 * moment". Getting that wrong is not cosmetic: telling somebody to request a new link when
 * the server returned 429 or 500 sends them straight back into the path that just failed.
 */
const LINK_ERROR_CODES = new Set(['INVALID_TOKEN', 'TOKEN_EXPIRED', 'USER_NOT_FOUND']);
const PASSWORD_ERROR_CODES = new Set(['PASSWORD_TOO_SHORT', 'PASSWORD_TOO_LONG']);

/**
 * Covers unknown as well as expired on purpose. Better-Auth answers both with
 * `INVALID_TOKEN`, so a message claiming to know which one would be guessing half the time.
 * Same wording as nest-server's `LTNS_0027`, which is what arrives once the IAM path
 * translates it — this is the fallback for everything that does not.
 */
const LINK_DEAD_MESSAGE = 'Dieser Link ist nicht (mehr) gültig. Bitte fordere einen neuen an.';

// ============================================================================
// Lifecycle Hooks
// ============================================================================
onMounted(() => {
  // A token in the URL is the newest link and wins over a remembered one.
  if (isTokenValid.value) {
    keepLinkOutOfTheUrl();
    return;
  }

  token.value = recallLinkOnReload();

  // Any other way here is not the person who opened the mail continuing. On a shared device it
  // may be somebody else, who must not inherit the link, so the arrival erases it as well.
  if (!isTokenValid.value) {
    dropLink();
  }
});

// Leaving the form inside the app ends the flow. A reload is a full document load and never runs this.
onBeforeRouteLeave(() => {
  forgetResetLink();
});

// Starts the short window in which a reload may bring the link back (`RELOAD_WINDOW_MS`).
useEventListener('pagehide', stampResetLink);

// A return from the back/forward cache restores the page whole, token included, and runs no other
// hook. Browsers take this path for "Back" after another site, which may be the next person.
useEventListener('pageshow', (event) => {
  if (event.persisted) {
    dropLink();
  }
});

// ============================================================================
// Functions
// ============================================================================
async function onSubmit(payload: FormSubmitEvent<Schema>): Promise<void> {
  loading.value = true;
  submitError.value = '';
  passwordError.value = '';

  try {
    const result = await authClient.resetPassword({
      newPassword: payload.data.password,
      token: token.value,
    });
    const error = 'error' in result ? result.error : null;

    if (error) {
      applyError(error);
      return;
    }

    // Used up: a reload must not offer a form that can only fail.
    forgetResetLink();
    resetSuccess.value = true;
    // The form unmounts on success. Without moving focus it lands on <body>, so a keyboard
    // or screen-reader user loses their place entirely.
    await nextTick();
    successHeading.value?.focus();
  } catch {
    // Better-Auth normally returns `{ error }` rather than throwing, so this is the transport
    // failing: offline, DNS, a proxy closing the connection. "Request a new link" would be the
    // wrong advice — the link is very likely fine.
    submitError.value = 'Die Verbindung zum Server ist fehlgeschlagen. Bitte versuche es später erneut.';
    submitErrorKind.value = 'system';
  } finally {
    loading.value = false;
  }
}

/** Route one Better-Auth failure to the place where its correction happens. */
function applyError(error: { code?: string; message?: string }): void {
  const code = error.code ?? '';
  const translated = translateError(error.message ?? '');

  if (PASSWORD_ERROR_CODES.has(code)) {
    // Belongs at the field, not in the page alert: a page-level message about a field problem
    // reads like a system fault and invites a reload instead of an edit.
    passwordError.value = translated || 'Das Passwort erfüllt die Anforderungen nicht.';
    return;
  }

  submitErrorKind.value = LINK_ERROR_CODES.has(code) ? 'link' : 'system';

  if (LINK_ERROR_CODES.has(code)) {
    // The server has declared this token dead. Input and system errors keep it: they say
    // nothing about the link, and the retry needs it.
    forgetResetLink();
    // `USER_NOT_FOUND` deliberately carries no translation from nest-server — translating it
    // would make an account-enumeration oracle easier to read. Our own wording covers it, and
    // it says the same thing a dead link says, which is what it is from here.
    submitError.value = code === 'USER_NOT_FOUND' ? LINK_DEAD_MESSAGE : translated || LINK_DEAD_MESSAGE;
    return;
  }

  // Rate limits, 5xx, anything unrecognised. Never "request a new link" — that returns the
  // user to the same overloaded path and produces the same failure.
  submitError.value = translated || 'Das Zurücksetzen ist gerade nicht möglich. Bitte versuche es später erneut.';
}

/**
 * Drop the token from the address bar once it is in hand, and bind it to this history entry.
 *
 * It stays valid until used or expired, and would otherwise survive in browser history and travel
 * with the URL whenever somebody pastes it asking for help. Replacing keeps the entry rather than
 * adding one, so Back still behaves.
 *
 * Through the router, never `history.replaceState`: vue-router keeps its own copy of the location,
 * writes it into `current` of the entry it leaves and into `back` of the entry it creates. That
 * put the token back into the URL and into `history.state` on the first in-app navigation.
 */
function keepLinkOutOfTheUrl(): void {
  const id = createResetLinkId();
  rememberResetLink(id, token.value);
  void router.replace({ path: route.path, state: { [RESET_LINK_HISTORY_KEY]: id } });
}

/**
 * The remembered link, when this arrival is a reload of the history entry that received it.
 *
 * The Navigation Timing type counts for the whole document, so a redirect after reloading the
 * login page passes it. The entry id survives "Back", which may be the next person, so `back_forward`
 * does not qualify. It takes both, and `recallResetLink` adds the time since the page was left.
 */
function recallLinkOnReload(): string {
  const [navigation] = window.performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  return navigation?.type === 'reload' ? recallResetLink(window.history.state?.[RESET_LINK_HISTORY_KEY]) : '';
}

/** Ends the link on this page: nothing left to submit, nothing left to recall. */
function dropLink(): void {
  token.value = '';
  forgetResetLink();
  submitError.value = 'Der Link zum Zurücksetzen des Passworts ist ungültig oder fehlt.';
  submitErrorKind.value = 'link';
}
</script>

<template>
  <UPageCard class="w-md" variant="naked">
    <template v-if="resetSuccess">
      <div class="flex flex-col items-center gap-6">
        <UIcon name="i-lucide-check-circle" class="size-16 text-success" />
        <div class="text-center">
          <h1 ref="successHeading" tabindex="-1" class="text-xl font-semibold">Passwort zurückgesetzt</h1>
          <p class="mt-2 text-sm text-muted">Dein Passwort wurde erfolgreich geändert. Du kannst dich jetzt mit deinem neuen Passwort anmelden.</p>
        </div>

        <UButton to="/auth/login" block> Zur Anmeldung </UButton>
      </div>
    </template>

    <template v-else>
      <UAlert
        v-if="submitError"
        :color="submitErrorKind === 'link' ? 'error' : 'warning'"
        :description="submitError"
        :icon="submitErrorKind === 'link' ? 'i-lucide-link-2-off' : 'i-lucide-alert-triangle'"
        :title="submitErrorKind === 'link' ? 'Link nicht mehr gültig' : 'Gerade nicht möglich'"
        class="mb-4"
      />

      <UAuthForm
        :schema="schema"
        title="Neues Passwort"
        icon="i-lucide-shield-check"
        :fields="fields"
        :loading="loading"
        :submit="{
          label: 'Passwort speichern',
          block: true,
          disabled: !isTokenValid,
        }"
        @submit="onSubmit"
      >
        <template #title>
          <h1 class="text-2xl font-bold">Neues Passwort</h1>
        </template>

        <template #validation>
          <UAlert v-if="passwordError" color="error" icon="i-lucide-alert-triangle" title="Passwort ungültig" :description="passwordError" />
        </template>

        <template #footer>
          <p class="text-center text-sm text-muted">
            <ULink to="/auth/forgot-password" class="text-primary font-medium"> Neuen Link anfordern </ULink>
          </p>
        </template>
      </UAuthForm>
    </template>
  </UPageCard>
</template>
