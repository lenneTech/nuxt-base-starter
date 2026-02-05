<script lang="ts" setup>
// ============================================================================
// Imports
// ============================================================================
import type { FormSubmitEvent } from '@nuxt/ui';
import type { InferOutput } from 'valibot';

import * as v from 'valibot';

// Auth client from @lenne.tech/nuxt-extensions
const authClient = useLtAuthClient();

// ============================================================================
// Props & Emits
// ============================================================================
interface Props {
  initialCodes?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  initialCodes: () => [],
});

const emit = defineEmits<{
  close: [result?: unknown];
}>();

// ============================================================================
// Composables
// ============================================================================
const toast = useToast();

// ============================================================================
// Variables
// ============================================================================
const loading = ref<boolean>(false);
const backupCodes = ref<string[]>(props.initialCodes);

const passwordSchema = v.object({
  password: v.pipe(v.string('Passwort ist erforderlich'), v.minLength(1, 'Passwort ist erforderlich')),
});

type PasswordSchema = InferOutput<typeof passwordSchema>;

// ============================================================================
// Functions
// ============================================================================
function copyBackupCodes(): void {
  navigator.clipboard.writeText(backupCodes.value.join('\n'));
  toast.add({
    color: 'success',
    description: 'Backup-Codes wurden in die Zwischenablage kopiert',
    title: 'Kopiert',
  });
}

async function generateBackupCodes(payload: FormSubmitEvent<PasswordSchema>): Promise<void> {
  loading.value = true;

  try {
    const { data, error } = await authClient.twoFactor.generateBackupCodes({
      password: payload.data.password,
    });

    if (error) {
      toast.add({
        color: 'error',
        description: error.message || 'Backup-Codes konnten nicht generiert werden',
        title: 'Fehler',
      });
      return;
    }

    backupCodes.value = data?.backupCodes ?? [];
  } finally {
    loading.value = false;
  }
}

function handleClose(): void {
  emit('close');
}
</script>

<template>
  <UModal title="Backup-Codes" :close="{ onClick: handleClose }">
    <template #body>
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-key" class="size-6 text-warning" />
          <p class="text-sm text-muted">Bewahre diese Codes sicher auf. Jeder Code kann nur einmal verwendet werden.</p>
        </div>

        <template v-if="backupCodes.length > 0">
          <div class="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-4 font-mono text-sm">
            <span v-for="code in backupCodes" :key="code">{{ code }}</span>
          </div>
        </template>

        <template v-else>
          <UForm :schema="passwordSchema" class="space-y-4" @submit="generateBackupCodes">
            <UFormField label="Passwort" name="password">
              <UInput name="password" type="password" placeholder="Dein Passwort" />
            </UFormField>
            <UButton type="submit" block :loading="loading"> Neue Backup-Codes generieren </UButton>
          </UForm>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton v-if="backupCodes.length > 0" variant="outline" icon="i-lucide-copy" @click="copyBackupCodes"> Codes kopieren </UButton>
        <UButton color="neutral" variant="outline" @click="handleClose"> Schließen </UButton>
      </div>
    </template>
  </UModal>
</template>
