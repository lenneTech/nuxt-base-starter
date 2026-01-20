<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type { AuthFormField, FormSubmitEvent } from '@nuxt/ui';
import type { InferOutput } from 'valibot';

import * as v from 'valibot';

import { authClient } from '~/lib/auth-client';

// ============================================================================
// Composables
// ============================================================================
const toast = useToast();
const { signIn, setUser, isLoading, validateSession } = useBetterAuth();

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
 * Uses official Better Auth signIn.passkey() method
 * @see https://www.better-auth.com/docs/plugins/passkey
 */
async function onPasskeyLogin(): Promise<void> {
  passkeyLoading.value = true;

  try {
    // Use official Better Auth client method
    // This calls: GET /passkey/generate-authenticate-options → POST /passkey/verify-authentication
    const result = await authClient.signIn.passkey();

    // Check for error in response
    if (result.error) {
      toast.add({
        color: 'error',
        description: result.error.message || 'Passkey-Anmeldung fehlgeschlagen',
        title: 'Fehler',
      });
      return;
    }

    // Update auth state with user data if available
    if (result.data?.user) {
      setUser(result.data.user as any);
    } else if (result.data?.session) {
      // Passkey auth returns session without user - fetch user via session validation
      await validateSession();
    }

    await navigateTo('/app');
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
// Functions
// ============================================================================
async function onSubmit(payload: FormSubmitEvent<Schema>): Promise<void> {
  loading.value = true;

  try {
    const result = await signIn.email({
      email: payload.data.email,
      password: payload.data.password,
    });

    // Check for error in response
    if ('error' in result && result.error) {
      toast.add({
        color: 'error',
        description: (result.error as { message?: string }).message || 'Anmeldung fehlgeschlagen',
        title: 'Fehler',
      });
      return;
    }

    // Check if 2FA is required
    // Better-Auth native uses 'twoFactorRedirect', nest-server REST API uses 'requiresTwoFactor'
    const resultData = 'data' in result ? result.data : result;
    const requires2FA = resultData && (
      ('twoFactorRedirect' in resultData && resultData.twoFactorRedirect) ||
      ('requiresTwoFactor' in resultData && resultData.requiresTwoFactor)
    );
    if (requires2FA) {
      // Redirect to 2FA page
      await navigateTo('/auth/2fa');
      return;
    }

    // Check if login was successful (user data in response)
    const userData = 'user' in result ? result.user : ('data' in result ? result.data?.user : null);
    if (userData) {
      // Auth state is already stored by useBetterAuth
      // Navigate to app
      await navigateTo('/app');
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

          <p class="text-center text-sm text-muted">
            Noch kein Konto?
            <ULink to="/auth/register" class="text-primary font-medium">Registrieren</ULink>
          </p>
        </div>
      </template>
    </UAuthForm>
  </UPageCard>
</template>
