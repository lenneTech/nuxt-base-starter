<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type { FormSubmitEvent } from '@nuxt/ui';
import type { InferOutput } from 'valibot';

import * as v from 'valibot';

// ============================================================================
// Composables
// ============================================================================
const route = useRoute();
const router = useRouter();
const toast = useToast();
const runtimeConfig = useRuntimeConfig();
const authClient = useLtAuthClient();
const { translateError } = useLtErrorTranslation();

// For `/features` and `/resend-verification-email`, which are nest-server endpoints rather than
// Better-Auth ones and therefore have no client method. The verification itself does not use it.
const apiBase = import.meta.dev ? '/api/iam' : `${runtimeConfig.public.apiUrl || 'http://localhost:3000'}/iam`;

/** Covers "never existed" and "expired" alike — Better Auth answers both the same way. */
const LINK_DEAD_MESSAGE = 'Dieser Link ist nicht (mehr) gültig. Bitte fordere einen neuen an.';

const SEND_FAILED_MESSAGE = 'Die E-Mail konnte nicht gesendet werden. Bitte versuche es später erneut.';

// ============================================================================
// Page Meta
// ============================================================================
definePageMeta({
  layout: 'slim',
});

useHead({
  title: 'E-Mail bestätigen',
});

// ============================================================================
// Variables
// ============================================================================
/**
 * Read once into refs rather than computeds over `route.query`: `onMounted` moves both out of the
 * URL (see `keepSecretsOutOfTheUrl`), which would empty a computed. Reading synchronously keeps SSR
 * and the first client render in agreement. An address handed over in the history entry
 * (`verifyEmailState`) arrives in `onMounted`, since the server never sees `history.state`.
 *
 * From nest-server 12.6.0 on the mail link carries the token only, so `email` stays empty for a
 * visitor who comes from the mail.
 */
const email = ref<string>(typeof route.query.email === 'string' ? route.query.email : '');
const token = ref<string>(typeof route.query.token === 'string' ? route.query.token : '');

/**
 * Where the "back to sign-in" buttons point.
 *
 * This page is a detour inside a sign-in that started on `/auth/login`, and it ends
 * by sending the visitor back there. Carrying `?redirect=` along is what keeps a
 * shared deep link alive across the detour — without it the target is dropped here
 * and the visitor lands on the dashboard after verifying.
 *
 * Note the limit: the verification LINK itself is built by the backend and travels
 * through an e-mail, so a visitor who returns via that link arrives without the
 * query. This only preserves the target for the in-tab path (verify, then sign in).
 */
const loginLink = computed(() =>
  typeof route.query.redirect === 'string' ? { path: '/auth/login', query: { redirect: safeRedirectTarget(route.query.redirect) } } : '/auth/login',
);

const verifying = ref(false);
const verified = ref(false);
const verifyError = ref('');
const resending = ref(false);
const resendCooldown = ref(0);
const cooldownSeconds = ref(60);
let cooldownInterval: ReturnType<typeof setInterval> | null = null;

/** The API takes the token of a refused link for a new mail (`GET /iam/features`, nest-server 12.6.0+). */
const resendByToken = ref(false);

/**
 * The token of the link the server refused. It confirms nothing any more, but from nest-server
 * 12.6.0 on it asks for a new mail to the address it belongs to, so nobody types the address and it
 * never travels. Set only after the server said the link is dead, and only while the API takes it.
 */
const deadToken = ref('');

/** The address a new mail went to, as the server masked it (`k***@example.com`). */
const maskedEmail = ref('');

/** The fallback when the page knows no address and no token can stand in for it. */
const addressForm = reactive({ email: '' });

const addressSchema = v.object({
  email: v.pipe(
    v.string('Bitte gib deine E-Mail-Adresse ein.'),
    v.trim(),
    v.nonEmpty('Bitte gib deine E-Mail-Adresse ein.'),
    v.email('Bitte gib eine gültige E-Mail-Adresse ein.'),
  ),
});

type AddressSchema = InferOutput<typeof addressSchema>;

// ============================================================================
// Computed
// ============================================================================
/**
 * How "send a new e-mail" reaches the account.
 *
 * - `token`: the refused link's token goes to the API, which mails the address it belongs to.
 * - `address`: the page knows the address, handed over by login or sign-up, or from `&email=` in a
 *   link of a server before 12.6.0.
 * - `typed`: neither, so the visitor types it. That is the case for a visit without a link, an API
 *   without the endpoint, or a token the API cannot read.
 */
const resendMode = computed<'address' | 'token' | 'typed'>(() => {
  if (deadToken.value && resendByToken.value) {
    return 'token';
  }
  return email.value ? 'address' : 'typed';
});

const resendLabel = computed(() => {
  const label = verifyError.value ? 'Neue E-Mail senden' : 'Bestätigungs-E-Mail erneut senden';
  return resendCooldown.value > 0 ? `${label} (${resendCooldown.value}s)` : label;
});

// ============================================================================
// Functions
// ============================================================================
async function verifyEmailWithToken(verificationToken: string): Promise<void> {
  verifying.value = true;
  verifyError.value = '';

  try {
    // No `callbackURL` here, deliberately. The endpoint branches on it: with one it answers 302
    // to that URL carrying neither token nor status, without one it answers `{ status: true }`
    // as JSON. It is NOT the same parameter as the one that goes into the mail below, and
    // passing it here produces a page that reports failure on success.
    const { data, error } = await authClient.verifyEmail({ query: { token: verificationToken } });

    if (error || !data?.status) {
      verifyError.value = error?.message ? translateError(error.message) : LINK_DEAD_MESSAGE;
      // Better Auth refuses a dead link with 401 (expired, invalid, no such user). Then its token can
      // still ask for a new mail, and a reload should find it, since the URL no longer carries it. A
      // 5xx says nothing about the link, so its token is not kept.
      const linkRefused = !(typeof error?.status === 'number' && error.status >= 500);
      if (linkRefused && resendByToken.value) {
        deadToken.value = verificationToken;
        rememberPage();
      }
      return;
    }

    verified.value = true;
    rememberPage();
    toast.add({
      color: 'success',
      description: 'Deine E-Mail-Adresse wurde erfolgreich verifiziert.',
      title: 'E-Mail bestätigt',
    });
  } catch {
    // Better Auth returns `{ error }` rather than throwing, so reaching here means the transport
    // failed: offline, DNS, a proxy closing the connection. Telling the user their link is dead
    // would be the wrong advice — it is very likely fine.
    verifyError.value = 'Die Verbindung zum Server ist fehlgeschlagen. Bitte versuche es später erneut.';
  } finally {
    verifying.value = false;
  }
}

/** "Send a new e-mail" by the token of the refused link, or to the address the page knows. */
async function resendVerificationEmail(): Promise<void> {
  if (resending.value || resendCooldown.value > 0) return;

  if (resendMode.value === 'token') {
    await resendWithToken();
  } else if (email.value) {
    await resendToAddress(email.value);
  }
}

/**
 * "Send a new e-mail" to the address the visitor typed. It stays in the form and goes nowhere else:
 * not into the URL, and not into the history entry, which keeps only what login and sign-up handed
 * over.
 */
async function resendToTypedAddress(event: FormSubmitEvent<AddressSchema>): Promise<void> {
  if (resending.value || resendCooldown.value > 0) return;

  await resendToAddress(event.data.email);
}

/**
 * Ask the API to mail the address the refused token belongs to (nest-server 12.6.0+).
 *
 * The answer is the same whether a mail went out or not: an account that is verified already gets
 * none, and the page cannot tell. It says so in the message instead of promising a mail.
 */
async function resendWithToken(): Promise<void> {
  resending.value = true;

  try {
    const answer = await $fetch<{ email: null | string; success: boolean }>(`${apiBase}/resend-verification-email`, {
      body: { token: deadToken.value },
      method: 'POST',
    });

    if (!answer?.email) {
      // The API cannot read this token at all, so there is no address to mail. Ask for it.
      deadToken.value = '';
      rememberPage();
      toast.add({
        color: 'error',
        description: 'Zu diesem Link können wir keine neue E-Mail senden. Gib deine E-Mail-Adresse ein, dann schicken wir dir einen neuen Link.',
        title: 'Link nicht erkannt',
      });
      return;
    }

    maskedEmail.value = answer.email;
    toast.add({
      color: 'success',
      description: `Falls dein Konto noch nicht bestätigt ist, ist eine neue Bestätigungs-E-Mail an ${answer.email} unterwegs.`,
      title: 'E-Mail gesendet',
    });
    startCooldown(cooldownSeconds.value);
  } catch (error) {
    // A refusal from the API carries its message in the body (429 `LTNS_0020`: too many requests
    // for this link); a transport failure does not, and its message is no sentence for a visitor.
    const fromServer = typeof (error as { data?: { message?: unknown } })?.data?.message === 'string';
    toast.add({ color: 'error', description: fromServer ? translateError(error) : SEND_FAILED_MESSAGE, title: 'Fehler' });
  } finally {
    resending.value = false;
  }
}

/** Ask Better Auth to mail `address`; `true` once the request went through. */
async function resendToAddress(address: string): Promise<boolean> {
  resending.value = true;

  try {
    const { error } = await authClient.sendVerificationEmail({
      // Absolute, and it must stay that way. Better Auth resolves a relative value against its
      // OWN origin, so `/auth/verify-email` becomes `api.<host>/auth/verify-email`, where the
      // route does not exist — the mail goes out and the user follows a link to a 404. The
      // client passes this through untouched on purpose. See `utils/app-origin.ts`.
      callbackURL: appUrl('/auth/verify-email', runtimeConfig.public.siteUrl),
      email: address,
    });

    if (error) {
      toast.add({
        color: 'error',
        description: error.message ? translateError(error.message) : SEND_FAILED_MESSAGE,
        title: 'Fehler',
      });
      return false;
    }

    toast.add({
      color: 'success',
      description: 'Eine neue Bestätigungs-E-Mail wurde gesendet.',
      title: 'E-Mail gesendet',
    });

    startCooldown(cooldownSeconds.value);
    return true;
  } catch {
    toast.add({
      color: 'error',
      description: SEND_FAILED_MESSAGE,
      title: 'Fehler',
    });
    return false;
  } finally {
    resending.value = false;
  }
}

/**
 * Move the token and the address out of the URL, into this history entry.
 *
 * The token confirms the account until it expires, and the address names its owner. In the URL both
 * would stay in the browser history and travel with every link somebody pastes. Replacing keeps the
 * entry rather than adding one, so Back still behaves. Through the router, never
 * `history.replaceState`: vue-router keeps its own copy of the location and would write the old URL
 * into the next entry it creates (see `reset-password.vue`).
 */
async function keepSecretsOutOfTheUrl(): Promise<void> {
  if (!('email' in route.query) && !('token' in route.query)) {
    return;
  }
  const query = Object.fromEntries(Object.entries(route.query).filter(([key]) => key !== 'email' && key !== 'token'));
  await router.replace({ path: route.path, query, state: verifyEmailState(email.value) });
}

/**
 * Whether a token is sealed: a compact JWE (five parts), as nest-server 12.6.0+ puts into the link.
 * Better Auth's own token, from a mail sent before the update, is a JWT (three parts) whose payload
 * carries the address and the user id in plain text.
 */
function isSealed(value: string): boolean {
  return value.split('.').length === 5;
}

/**
 * Note in this history entry what a reload needs: the address, the outcome of an accepted link, and
 * the token of a refused one. Only a sealed token: a readable one would put the address and the user
 * id into the entry, and a reload then falls back to the address the page knows.
 *
 * `history.replaceState` is safe here, unlike for the token in the URL: the URL stays the one the
 * router already holds, and vue-router merges `history.state` whenever it rewrites this entry.
 */
function rememberPage(): void {
  const keptToken = isSealed(deadToken.value) ? deadToken.value : '';
  window.history.replaceState({ ...window.history.state, ...verifyEmailState(email.value, { deadToken: keptToken, verified: verified.value }) }, '');
}

function startCooldown(seconds: number): void {
  resendCooldown.value = seconds;
  if (cooldownInterval) clearInterval(cooldownInterval);
  cooldownInterval = setInterval(() => {
    resendCooldown.value--;
    if (resendCooldown.value <= 0) {
      if (cooldownInterval) clearInterval(cooldownInterval);
      cooldownInterval = null;
    }
  }, 1000);
}

// ============================================================================
// Lifecycle
// ============================================================================
onMounted(async () => {
  const remembered = recallVerifyEmail(window.history.state);
  email.value ||= remembered.email;
  // First, before any request: the URL should not keep the secrets while the page waits.
  await keepSecretsOutOfTheUrl();

  // The resend cooldown, and whether the API takes a refused link's token for a new mail
  try {
    const features = await $fetch<Record<string, boolean | number | string[]>>(`${apiBase}/features`);
    if (typeof features?.resendCooldownSeconds === 'number') {
      cooldownSeconds.value = features.resendCooldownSeconds;
    }
    resendByToken.value = features?.resendVerificationByToken === true;
  } catch {
    // Use the default cooldown, and the address instead of the token, if features are unavailable
  }

  if (token.value) {
    await verifyEmailWithToken(token.value);
  } else if (remembered.verified) {
    // A reload after the link was accepted: the token has left the URL, the outcome has not.
    verified.value = true;
  } else if (remembered.deadToken) {
    // A reload after the link was refused: offer the new mail again, without asking the server
    // a second time about a token it already refused.
    deadToken.value = remembered.deadToken;
    verifyError.value = LINK_DEAD_MESSAGE;
  } else if (route.query.fromRegister === 'true') {
    // Email was just sent during registration, start initial cooldown
    startCooldown(cooldownSeconds.value);
  }
});

onUnmounted(() => {
  if (cooldownInterval) clearInterval(cooldownInterval);
});
</script>

<template>
  <UPageCard class="w-md" variant="naked">
    <!-- Verifying state: Token verification in progress -->
    <template v-if="verifying">
      <div class="flex flex-col items-center gap-6 py-4">
        <UIcon name="i-lucide-loader-circle" class="size-16 animate-spin text-primary" />
        <div class="text-center">
          <h1 class="text-xl font-semibold">E-Mail wird verifiziert...</h1>
          <p class="mt-2 text-sm text-muted">Bitte warte einen Moment.</p>
        </div>
      </div>
    </template>

    <!-- Success state: Email verified -->
    <template v-else-if="verified">
      <div class="flex flex-col items-center gap-6 py-4">
        <UIcon name="i-lucide-check-circle" class="size-16 text-success" />
        <div class="text-center">
          <h1 class="text-xl font-semibold">E-Mail bestätigt</h1>
          <p class="mt-2 text-sm text-muted">Deine E-Mail-Adresse wurde erfolgreich verifiziert. Du kannst dich jetzt anmelden.</p>
        </div>
        <UButton block :to="loginLink">Jetzt anmelden</UButton>
      </div>
    </template>

    <!-- Error state (link refused) and pending state (waiting for the mail) share the resend -->
    <div v-else class="flex flex-col items-center gap-6 py-4">
      <template v-if="verifyError">
        <UIcon name="i-lucide-x-circle" class="size-16 text-error" />
        <div class="text-center">
          <h1 class="text-xl font-semibold">Verifizierung fehlgeschlagen</h1>
          <p class="mt-2 text-sm text-muted">{{ verifyError }}</p>
        </div>
      </template>

      <template v-else>
        <UIcon name="i-lucide-mail-check" class="size-16 text-primary" />
        <div class="text-center">
          <h1 class="text-xl font-semibold">E-Mail bestätigen</h1>
          <p class="mt-2 text-sm text-muted">
            Wir haben eine Bestätigungs-E-Mail an
            <strong v-if="email">{{ email }}</strong>
            <span v-else>deine E-Mail-Adresse</span>
            gesendet.
          </p>
          <p class="mt-2 text-sm text-muted">Bitte klicke auf den Link in der E-Mail, um dein Konto zu aktivieren.</p>
        </div>

        <UAlert color="neutral" icon="i-lucide-info" title="Keine E-Mail erhalten?" variant="subtle">
          <template #description>
            <ul class="mt-1 list-inside list-disc text-sm">
              <li>Prüfe deinen Spam-Ordner</li>
              <li>Stelle sicher, dass die E-Mail-Adresse korrekt ist</li>
            </ul>
          </template>
        </UAlert>
      </template>

      <p v-if="maskedEmail" class="text-center text-sm text-muted" role="status">
        Neue E-Mail angefordert für <strong>{{ maskedEmail }}</strong>
      </p>

      <div class="flex w-full flex-col gap-3">
        <!-- Fallback: no address known, and no token the API takes instead -->
        <UForm v-if="resendMode === 'typed'" :schema="addressSchema" :state="addressForm" class="flex flex-col gap-3" @submit="resendToTypedAddress">
          <UFormField label="E-Mail-Adresse" name="email">
            <UInput v-model="addressForm.email" autocomplete="email" class="w-full" placeholder="name@beispiel.de" type="email" />
          </UFormField>
          <UButton block :disabled="resendCooldown > 0" :loading="resending" type="submit">{{ resendLabel }}</UButton>
        </UForm>
        <UButton
          v-else
          block
          :color="resendCooldown > 0 ? 'neutral' : 'primary'"
          :disabled="resendCooldown > 0"
          :loading="resending"
          :variant="resendCooldown > 0 ? (verifyError ? 'outline' : 'subtle') : verifyError ? 'solid' : 'outline'"
          @click="resendVerificationEmail"
        >
          {{ resendLabel }}
        </UButton>
        <UButton block variant="outline" color="neutral" :to="loginLink">Zurück zur Anmeldung</UButton>
      </div>
    </div>
  </UPageCard>
</template>
