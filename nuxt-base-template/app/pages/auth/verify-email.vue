<script setup lang="ts">
// ============================================================================
// Composables
// ============================================================================
const route = useRoute();
const toast = useToast();
const runtimeConfig = useRuntimeConfig();
const apiBase = import.meta.dev ? '/api/iam' : `${runtimeConfig.public.apiUrl || 'http://localhost:3000'}/iam`;

// ============================================================================
// Page Meta
// ============================================================================
definePageMeta({
  layout: 'slim',
});

// ============================================================================
// Variables
// ============================================================================
const email = computed(() => (route.query.email as string) || '');
const token = computed(() => (route.query.token as string) || '');

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
    const result = await $fetch<{ status: boolean }>(`${apiBase}/verify-email`, {
      params: { token: verificationToken },
      redirect: 'manual',
    });

    if (!result?.status) {
      verifyError.value = 'Verifizierung fehlgeschlagen';
      return;
    }

    verified.value = true;
    toast.add({
      color: 'success',
      description: 'Deine E-Mail-Adresse wurde erfolgreich verifiziert.',
      title: 'E-Mail bestätigt',
    });
  } catch {
    verifyError.value = 'Die Verifizierung ist fehlgeschlagen. Der Link ist möglicherweise abgelaufen.';
  } finally {
    verifying.value = false;
  }
}

async function resendVerificationEmail(): Promise<void> {
  if (!email.value || resendCooldown.value > 0) return;

  resending.value = true;

  try {
    await $fetch(`${apiBase}/send-verification-email`, {
      body: {
        callbackURL: '/auth/verify-email',
        email: email.value,
      },
      method: 'POST',
    });

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
          <h2 class="text-xl font-semibold">E-Mail wird verifiziert...</h2>
          <p class="mt-2 text-sm text-muted">Bitte warte einen Moment.</p>
        </div>
      </div>
    </template>

    <!-- Success state: Email verified -->
    <template v-else-if="verified">
      <div class="flex flex-col items-center gap-6 py-4">
        <UIcon name="i-lucide-check-circle" class="size-16 text-success" />
        <div class="text-center">
          <h2 class="text-xl font-semibold">E-Mail bestätigt</h2>
          <p class="mt-2 text-sm text-muted">Deine E-Mail-Adresse wurde erfolgreich verifiziert. Du kannst dich jetzt anmelden.</p>
        </div>
        <UButton block to="/auth/login">Jetzt anmelden</UButton>
      </div>
    </template>

    <!-- Error state: Verification failed -->
    <template v-else-if="verifyError">
      <div class="flex flex-col items-center gap-6 py-4">
        <UIcon name="i-lucide-x-circle" class="size-16 text-error" />
        <div class="text-center">
          <h2 class="text-xl font-semibold">Verifizierung fehlgeschlagen</h2>
          <p class="mt-2 text-sm text-muted">{{ verifyError }}</p>
        </div>

        <div class="flex w-full flex-col gap-3">
          <UButton v-if="email" block :color="resendCooldown > 0 ? 'neutral' : 'primary'" :disabled="resendCooldown > 0" :loading="resending" :variant="resendCooldown > 0 ? 'outline' : 'solid'" @click="resendVerificationEmail">
            {{ resendCooldown > 0 ? `Neue E-Mail senden (${resendCooldown}s)` : 'Neue E-Mail senden' }}
          </UButton>
          <UButton block variant="outline" color="neutral" to="/auth/login">Zurück zur Anmeldung</UButton>
        </div>
      </div>
    </template>

    <!-- Pending state: Waiting for verification (from register page) -->
    <template v-else>
      <div class="flex flex-col items-center gap-6 py-4">
        <UIcon name="i-lucide-mail-check" class="size-16 text-primary" />
        <div class="text-center">
          <h2 class="text-xl font-semibold">E-Mail bestätigen</h2>
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
          <UButton v-if="email" block :color="resendCooldown > 0 ? 'neutral' : 'primary'" :disabled="resendCooldown > 0" :loading="resending" :variant="resendCooldown > 0 ? 'subtle' : 'outline'" @click="resendVerificationEmail">
            {{ resendCooldown > 0 ? `Bestätigungs-E-Mail erneut senden (${resendCooldown}s)` : 'Bestätigungs-E-Mail erneut senden' }}
          </UButton>
          <UButton block variant="outline" color="neutral" to="/auth/login">Zurück zur Anmeldung</UButton>
        </div>
      </div>
    </template>
  </UPageCard>
</template>
