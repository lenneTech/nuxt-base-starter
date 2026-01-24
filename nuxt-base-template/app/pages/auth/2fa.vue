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
const toast = useToast();
const { fetchWithAuth, setUser, switchToJwtMode, jwtToken } = useLtAuth();
const authClient = useLtAuthClient();

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
const useBackupCode = ref<boolean>(false);
const trustDevice = ref<boolean>(false);

// Form state for UForm
const formState = reactive({ code: '' });

const schema = v.object({
  code: v.pipe(v.string('Code ist erforderlich'), v.minLength(6, 'Code muss mindestens 6 Zeichen haben')),
});

type Schema = InferOutput<typeof schema>;

// ============================================================================
// Functions
// ============================================================================
async function onSubmit(payload: FormSubmitEvent<Schema>): Promise<void> {
  loading.value = true;

  try {
    let result: any;

    if (useBackupCode.value) {
      result = await authClient.twoFactor.verifyBackupCode({
        code: payload.data.code,
      });

      if (result.error) {
        toast.add({
          color: 'error',
          description: result.error.message || 'Backup-Code ungültig',
          title: 'Fehler',
        });
        return;
      }
    } else {
      result = await authClient.twoFactor.verifyTotp({
        code: payload.data.code,
        trustDevice: trustDevice.value,
      });

      if (result.error) {
        toast.add({
          color: 'error',
          description: result.error.message || 'Code ungültig',
          title: 'Fehler',
        });
        return;
      }
    }

    // Extract token and user data from response (JWT mode: cookies: false)
    const token = result?.token || result?.data?.token;
    const userData = result?.data?.user || result?.user;

    if (token) {
      // JWT mode: Token is in the response
      jwtToken.value = token;
      if (userData) {
        setUser(userData, 'jwt');
      }
      console.debug('[Auth] JWT token received from 2FA response');
    } else if (userData) {
      // Cookie mode: No token in response, use cookies
      setUser(userData, 'cookie');
      // Try to get JWT token for fallback
      switchToJwtMode().catch(() => {});
    } else {
      // Fallback: fetch session data from API using authenticated fetch
      try {
        const isDev = import.meta.dev;
        const runtimeConfig = useRuntimeConfig();
        const apiBase = isDev ? '/api/iam' : `${runtimeConfig.public.apiUrl || 'http://localhost:3000'}/iam`;
        const sessionResponse = await fetchWithAuth(`${apiBase}/get-session`);
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          const sessionToken = sessionData?.token;
          if (sessionToken) {
            jwtToken.value = sessionToken;
            if (sessionData?.user) {
              setUser(sessionData.user, 'jwt');
            }
          } else if (sessionData?.user) {
            setUser(sessionData.user, 'cookie');
            switchToJwtMode().catch(() => {});
          }
        }
      } catch {
        // Ignore session fetch errors
      }
    }

    await navigateTo('/app');
  } finally {
    loading.value = false;
  }
}

function toggleBackupCode(): void {
  useBackupCode.value = !useBackupCode.value;
}
</script>

<template>
  <UPageCard class="w-md" variant="naked">
    <div class="flex flex-col gap-6">
      <div class="flex flex-col items-center gap-2">
        <UIcon name="i-lucide-shield-check" class="size-12 text-primary" />
        <h1 class="text-xl font-semibold">Zwei-Faktor-Authentifizierung</h1>
        <p class="text-center text-sm text-muted">
          {{ useBackupCode ? 'Gib einen deiner Backup-Codes ein' : 'Gib den 6-stelligen Code aus deiner Authenticator-App ein' }}
        </p>
      </div>

      <UForm :schema="schema" :state="formState" class="flex flex-col gap-4" @submit="onSubmit">
        <UFormField :label="useBackupCode ? 'Backup-Code' : 'Authentifizierungscode'" name="code">
          <UInput
            v-model="formState.code"
            :placeholder="useBackupCode ? 'Backup-Code eingeben' : '000000'"
            size="lg"
            class="text-center font-mono text-lg tracking-widest"
            autocomplete="one-time-code"
          />
        </UFormField>

        <UCheckbox v-if="!useBackupCode" v-model="trustDevice" label="Diesem Gerät vertrauen" />

        <UButton type="submit" block :loading="loading"> Verifizieren </UButton>
      </UForm>

      <div class="flex flex-col items-center gap-2">
        <UButton variant="link" color="neutral" @click="toggleBackupCode">
          {{ useBackupCode ? 'Authenticator-Code verwenden' : 'Backup-Code verwenden' }}
        </UButton>

        <ULink to="/auth/login" class="text-sm text-muted hover:text-primary"> Zurück zur Anmeldung </ULink>
      </div>
    </div>
  </UPageCard>
</template>
