<script setup lang="ts">
// ============================================================================
// Composables
// ============================================================================
const route = useRoute();
const router = useRouter();
const toast = useToast();
const runtimeConfig = useRuntimeConfig();
const authClient = useLtAuthClient();
const { translateError } = useLtErrorTranslation();

// Still needed for `/features`, which is a nest-server endpoint rather than a Better-Auth one
// and therefore has no client method. The two verification calls no longer use it.
const apiBase = import.meta.dev ? '/api/iam' : `${runtimeConfig.public.apiUrl || 'http://localhost:3000'}/iam`;

/** Covers "never existed" and "expired" alike — Better Auth answers both the same way. */
const LINK_DEAD_MESSAGE = 'Dieser Link ist nicht (mehr) gültig. Bitte fordere einen neuen an.';

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

    if (error) {
      verifyError.value = error.message ? translateError(error.message) : LINK_DEAD_MESSAGE;
      return;
    }

    if (!data?.status) {
      verifyError.value = LINK_DEAD_MESSAGE;
      return;
    }

    verified.value = true;
    rememberVerified();
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

async function resendVerificationEmail(): Promise<void> {
  if (!email.value || resendCooldown.value > 0) return;

  resending.value = true;

  try {
    const { error } = await authClient.sendVerificationEmail({
      // Absolute, and it must stay that way. Better Auth resolves a relative value against its
      // OWN origin, so `/auth/verify-email` becomes `api.<host>/auth/verify-email`, where the
      // route does not exist — the mail goes out and the user follows a link to a 404. The
      // client passes this through untouched on purpose. See `utils/app-origin.ts`.
      callbackURL: appUrl('/auth/verify-email', runtimeConfig.public.siteUrl),
      email: email.value,
    });

    if (error) {
      toast.add({
        color: 'error',
        description: error.message ? translateError(error.message) : 'Die E-Mail konnte nicht gesendet werden. Bitte versuche es später erneut.',
        title: 'Fehler',
      });
      return;
    }

    toast.add({
      color: 'success',
      description: 'Eine neue Bestätigungs-E-Mail wurde gesendet.',
      title: 'E-Mail gesendet',
    });

    startCooldown(cooldownSeconds.value);
  } catch {
    toast.add({
      color: 'error',
      description: 'Die E-Mail konnte nicht gesendet werden. Bitte versuche es später erneut.',
      title: 'Fehler',
    });
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
 * Note in this history entry that the link was accepted, so a reload confirms instead of waiting.
 *
 * `history.replaceState` is safe here, unlike for the token: the URL stays the one the router already
 * holds, and vue-router merges `history.state` whenever it rewrites this entry.
 */
function rememberVerified(): void {
  window.history.replaceState({ ...window.history.state, ...verifyEmailState(email.value, true) }, '');
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

  // Fetch dynamic cooldown configuration from backend
  try {
    const features = await $fetch<Record<string, boolean | number | string[]>>(`${apiBase}/features`);
    if (typeof features?.resendCooldownSeconds === 'number') {
      cooldownSeconds.value = features.resendCooldownSeconds;
    }
  } catch {
    // Use default cooldown if features endpoint is unavailable
  }

  if (token.value) {
    await verifyEmailWithToken(token.value);
  } else if (remembered.verified) {
    // A reload after the link was accepted: the token has left the URL, the outcome has not.
    verified.value = true;
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

    <!-- Error state: Verification failed -->
    <template v-else-if="verifyError">
      <div class="flex flex-col items-center gap-6 py-4">
        <UIcon name="i-lucide-x-circle" class="size-16 text-error" />
        <div class="text-center">
          <h1 class="text-xl font-semibold">Verifizierung fehlgeschlagen</h1>
          <p class="mt-2 text-sm text-muted">{{ verifyError }}</p>
        </div>

        <div class="flex w-full flex-col gap-3">
          <UButton
            v-if="email"
            block
            :color="resendCooldown > 0 ? 'neutral' : 'primary'"
            :disabled="resendCooldown > 0"
            :loading="resending"
            :variant="resendCooldown > 0 ? 'outline' : 'solid'"
            @click="resendVerificationEmail"
          >
            {{ resendCooldown > 0 ? `Neue E-Mail senden (${resendCooldown}s)` : 'Neue E-Mail senden' }}
          </UButton>
          <UButton block variant="outline" color="neutral" :to="loginLink">Zurück zur Anmeldung</UButton>
        </div>
      </div>
    </template>

    <!-- Pending state: Waiting for verification (from register page) -->
    <template v-else>
      <div class="flex flex-col items-center gap-6 py-4">
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

        <div class="flex w-full flex-col gap-3">
          <UButton
            v-if="email"
            block
            :color="resendCooldown > 0 ? 'neutral' : 'primary'"
            :disabled="resendCooldown > 0"
            :loading="resending"
            :variant="resendCooldown > 0 ? 'subtle' : 'outline'"
            @click="resendVerificationEmail"
          >
            {{ resendCooldown > 0 ? `Bestätigungs-E-Mail erneut senden (${resendCooldown}s)` : 'Bestätigungs-E-Mail erneut senden' }}
          </UButton>
          <UButton block variant="outline" color="neutral" :to="loginLink">Zurück zur Anmeldung</UButton>
        </div>
      </div>
    </template>
  </UPageCard>
</template>
