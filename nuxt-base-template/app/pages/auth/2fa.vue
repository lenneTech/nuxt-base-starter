<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type { LtUserInput } from '@lenne.tech/nuxt-extensions';
import type { FormSubmitEvent } from '@nuxt/ui';
import type { InferOutput } from 'valibot';

import * as v from 'valibot';

// ============================================================================
// Composables
// ============================================================================
const toast = useToast();
const { translateError } = useLtErrorTranslation();
const { setUser, switchToJwtMode, jwtToken } = useLtAuth();
const authClient = useLtAuthClient();
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
 * The fields this page reads from `verifyTotp` / `verifyBackupCode`: the error and the user, which
 * `onSubmit` accepts both under `data` and at the top level. The answer carries a `token` as well,
 * and the page deliberately never reads it (see `onSubmit`).
 */
interface TwoFactorVerifyResult {
  data?: null | { user?: LtUserInput };
  error?: null | { message?: string };
  user?: LtUserInput;
}

/** A JWT has three base64url parts; Better Auth's session token has none of that shape. */
const JWT_SHAPE = /^eyJ[\w-]*\.[\w-]+\.[\w-]+$/;

// ============================================================================
// Functions
// ============================================================================
async function onSubmit(payload: FormSubmitEvent<Schema>): Promise<void> {
  loading.value = true;

  try {
    let result: TwoFactorVerifyResult;

    if (useBackupCode.value) {
      result = await authClient.twoFactor.verifyBackupCode({
        code: payload.data.code,
      });

      if (result.error) {
        toast.add({
          color: 'error',
          // Not `translateError(...) || fallback` — that fallback never runs, because
          // `translateError` returns the input unchanged when it cannot translate it.
          description: result.error.message ? translateError(result.error.message) : 'Backup-Code ungültig',
          title: 'Bestätigung fehlgeschlagen',
        });
        return;
      }
    } else {
      result = await authClient.twoFactor.verifyTotp({
        code: payload.data.code,
      });

      if (result.error) {
        toast.add({
          color: 'error',
          description: result.error.message ? translateError(result.error.message) : 'Code ungültig',
          title: 'Bestätigung fehlgeschlagen',
        });
        return;
      }
    }

    // Never take a token from an answer. nest-server answers the second factor with
    // `{ token, user }`, and `token` is Better Auth's opaque session token: the credential the
    // httpOnly session cookie keeps away from scripts. `jwtToken` lives in `lt-jwt-token`, a cookie
    // any script on the page can read, so storing it there handed the session to every XSS for
    // seven days. The browser holds the session in its cookie already; a JWT comes from
    // `/iam/token` (`switchToJwtMode`). A session token an earlier version stored is removed.
    if (jwtToken.value && !JWT_SHAPE.test(jwtToken.value)) {
      jwtToken.value = null;
    }

    let userData = result?.data?.user || result?.user;
    if (!userData) {
      // Fallback: read the user from the session, never its token.
      //
      // This used to build the URL by hand and go through `fetchWithAuth`, because
      // `useLtAuthClient().getSession` did not survive the client's spread and was `undefined`
      // at runtime — the workaround, not a preference. Since nuxt-extensions 1.17.0 the method
      // is passed through explicitly, so the hand-built base URL can go.
      try {
        const { data: sessionData } = await authClient.getSession();
        userData = sessionData?.user ?? undefined;
      } catch {
        // Ignore session fetch errors
      }
    }

    if (userData) {
      setUser(userData, 'cookie');
      switchToJwtMode().catch(() => {});
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
