<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';
import type { InferOutput } from 'valibot';

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
const { signIn, setUser, validateSession, authenticateWithPasskey, features } = useLtAuth();
const { translateError } = useLtErrorTranslation();
const route = useRoute();

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

// ============================================================================
// Page Meta
// ============================================================================
definePageMeta({
  layout: 'slim',
});

// ============================================================================
// Variables
// ============================================================================
const loading = ref<boolean>(false);
const passkeyLoading = ref<boolean>(false);

const fields: AuthFormField[] = [
  {
    label: 'E-Mail',
    name: 'email',
    placeholder: 'E-Mail eingeben',
    required: true,
    type: 'email',
  },
  {
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
      setUser(result.user as any);
    } else {
      // Passkey auth may return success without user - fetch user via session validation
      await validateSession();
    }

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
// Functions
// ============================================================================
async function onSubmit(payload: FormSubmitEvent<Schema>): Promise<void> {
  loading.value = true;

  try {
    const result = (await signIn.email({
      email: payload.data.email,
      password: payload.data.password,
    })) as SignInResponse;

    // Check for error in response
    if (result.error) {
      const errorMessage = result.error.message || 'Anmeldung fehlgeschlagen';

      // Check if email verification is required → redirect to verify-email page
      if (errorMessage.includes('LTNS_0023') || errorMessage.toLowerCase().includes('email verification required')) {
        toast.add({
          color: 'warning',
          description: 'Bitte bestätige zuerst deine E-Mail-Adresse.',
          title: 'E-Mail nicht verifiziert',
        });
        // `redirectQuery` keeps the deep link alive across the verification detour.
        await navigateTo({ path: '/auth/verify-email', query: { email: payload.data.email, ...redirectQuery.value } });
        return;
      }

      toast.add({
        color: 'error',
        description: translateError(errorMessage),
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
      // Auth state is already stored by useLtAuth
      // Navigate to app
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
    <div ref="formRoot">
      <UAuthForm
        :schema="schema"
        title="Anmelden"
        icon="i-lucide-user"
        :fields="fields"
        :loading="loading"
        :submit="{
          label: 'Anmelden',
          block: true,
        }"
        @submit="onSubmit"
      >
        <template #password-hint>
          <ULink to="/auth/forgot-password" class="text-primary font-medium" tabindex="-1">Passwort vergessen?</ULink>
        </template>

        <template #footer>
          <div class="flex flex-col gap-4">
            <USeparator label="oder" />

            <UButton block color="neutral" variant="outline" icon="i-lucide-key" :loading="passkeyLoading" @click="onPasskeyLogin"> Mit Passkey anmelden </UButton>

            <p v-if="features.signUpEnabled !== false" class="text-center text-sm text-muted">
              Noch kein Konto?
              <ULink to="/auth/register" class="text-primary font-medium">Registrieren</ULink>
            </p>
          </div>
        </template>
      </UAuthForm>
    </div>
  </UPageCard>
</template>
