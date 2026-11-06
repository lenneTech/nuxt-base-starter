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
const { translateError } = useLtErrorTranslation();
const { twoFactor } = useLtAuth();
const route = useRoute();

// ============================================================================
// Computed
// ============================================================================
/**
 * Where to go once the second factor is accepted.
 *
 * This page completes a sign-in that STARTED on `/auth/login`, so it owns the final
 * navigation — and therefore the deep link. It used to navigate to `/app`
 * unconditionally, which meant every 2FA-enabled account lost the target that
 * `auth.global` had recorded, while accounts without 2FA kept it. `login.vue` now
 * forwards `?redirect=` here; this reads it back through the same validator the
 * other consumers use.
 */
const redirectTarget = computed(() => safeRedirectTarget(route.query.redirect));

// ============================================================================
// Page Meta
// ============================================================================
definePageMeta({
  layout: 'slim',
});

useHead({
  title: 'Zwei-Faktor-Bestätigung',
});

// ============================================================================
// Variables
// ============================================================================
const loading = ref<boolean>(false);
const useBackupCode = ref<boolean>(false);

// Form state for UForm
const formState = reactive({ code: '' });

const schema = v.object({
  code: v.pipe(v.string('Code ist erforderlich'), v.minLength(6, 'Code muss mindestens 6 Zeichen haben')),
});

type Schema = InferOutput<typeof schema>;

/**
 * Better Auth's refusals of the second factor that are not a wrong code. They carry no `#…_0000:`
 * marker, so `errorText` alone would show each as "Code ungültig", and the user would retry a code
 * that cannot work. `restart`: the challenge is spent, only a new sign-in starts another one.
 */
const TWO_FACTOR_REFUSALS: Record<string, { restart: boolean; text: string }> = {
  ACCOUNT_TEMPORARILY_LOCKED: {
    restart: false,
    text: 'Zu viele Fehlversuche. Die Bestätigung ist für einige Minuten gesperrt, bitte versuche es später erneut.',
  },
  INVALID_TWO_FACTOR_COOKIE: { restart: true, text: 'Die Bestätigung ist abgelaufen. Bitte melde dich erneut an.' },
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: { restart: true, text: 'Zu viele Versuche mit diesem Code. Bitte melde dich erneut an.' },
};

// ============================================================================
// Functions
// ============================================================================
async function onSubmit(payload: FormSubmitEvent<Schema>): Promise<void> {
  loading.value = true;

  try {
    // The helpers of nuxt-extensions 1.26.0 complete the sign-in: on the session cookie with a JWT
    // from `/iam/token`, or with the JWT the API answers in the JWT mode. They never store the
    // opaque session token nest-server 12.6.0 puts into the answer, the credential the httpOnly
    // cookie keeps away from scripts, and `lt-jwt-token` takes nothing but a JWT.
    const verify = useBackupCode.value ? twoFactor.verifyBackupCode : twoFactor.verifyTotp;
    const { error } = (await verify({ code: payload.data.code })) as { error?: null | { code?: string; message?: string } };

    if (error) {
      const refusal = error.code ? TWO_FACTOR_REFUSALS[error.code] : undefined;
      toast.add({
        color: 'error',
        description: refusal?.text ?? errorText(error.message, translateError, useBackupCode.value ? 'Backup-Code ungültig' : 'Code ungültig'),
        title: 'Bestätigung fehlgeschlagen',
      });
      if (refusal?.restart) {
        await navigateTo({ path: '/auth/login', query: { redirect: redirectTarget.value } });
      }
      return;
    }

    await navigateTo(redirectTarget.value);
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
