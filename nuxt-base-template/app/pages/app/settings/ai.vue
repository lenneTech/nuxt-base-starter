<script setup lang="ts">
// ============================================================================
// User AI settings: pick the personal default connection and view token usage.
// ============================================================================
useHead({ title: 'KI-Einstellungen' });

const toast = useToast();
const { connections, load: loadConnections, locked, select, selected } = useLtAiConnections();
const { load: loadUsage, usage } = useLtAiUsage();

onMounted(async () => {
  await Promise.all([loadConnections(), loadUsage()]);
});

async function choose(id: string): Promise<void> {
  try {
    await select(id);
    toast.add({ color: 'success', description: 'Standard-Verbindung gespeichert.', title: 'Erfolg' });
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  }
}

function pct(used: number, max?: number): number {
  return max && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-8">
    <div>
      <h1 class="text-2xl font-bold">KI-Einstellungen</h1>
      <p class="text-muted">Wähle deine bevorzugte KI-Verbindung und sieh deinen Verbrauch.</p>
    </div>

    <!-- Connection selection -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-plug" class="size-6 text-primary" />
          <div>
            <h2 class="font-semibold">KI-Verbindung</h2>
            <p class="text-sm text-muted">Deine Standard-Verbindung für Anfragen</p>
          </div>
        </div>
      </template>

      <div class="space-y-3">
        <UAlert v-if="locked" color="info" variant="subtle" icon="i-lucide-lock" description="Die Verbindung ist vorgegeben und kann nicht geändert werden." />
        <p v-if="!connections.length" class="py-4 text-center text-muted">Keine KI-Verbindung verfügbar.</p>
        <div v-for="conn in connections" :key="conn.id" class="flex items-center justify-between py-2">
          <div class="flex items-center gap-3">
            <UIcon
              :name="conn.id === selected?.id ? 'i-lucide-check-circle' : 'i-lucide-circle'"
              class="size-5"
              :class="conn.id === selected?.id ? 'text-primary' : 'text-muted'"
            />
            <div>
              <p class="font-medium">{{ conn.name || conn.id }}</p>
              <p class="text-xs text-muted">{{ conn.model }}<span v-if="conn.isDefault"> · Standard</span></p>
            </div>
          </div>
          <UButton v-if="conn.id !== selected?.id" size="sm" variant="outline" :disabled="locked" @click="choose(conn.id)"> Auswählen </UButton>
          <UBadge v-else color="primary" variant="subtle">Aktiv</UBadge>
        </div>
      </div>
    </UCard>

    <!-- Usage -->
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-gauge" class="size-6 text-primary" />
          <div>
            <h2 class="font-semibold">Verbrauch</h2>
            <p class="text-sm text-muted">Dein Token-Kontingent im aktuellen Zeitraum</p>
          </div>
        </div>
      </template>

      <div v-if="usage?.user" class="space-y-4">
        <div>
          <div class="mb-1 flex justify-between text-sm">
            <span class="text-muted">Tokens</span>
            <span class="font-medium">
              {{ usage.user.usedTokens }}<template v-if="usage.user.maxTokens"> / {{ usage.user.maxTokens }}</template>
            </span>
          </div>
          <UProgress v-if="usage.user.maxTokens" :model-value="pct(usage.user.usedTokens, usage.user.maxTokens)" />
          <p v-else class="text-xs text-muted">Unbegrenzt</p>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-muted">Anfragen</span>
          <span class="font-medium">
            {{ usage.user.usedPrompts }}<template v-if="usage.user.maxPrompts"> / {{ usage.user.maxPrompts }}</template>
          </span>
        </div>
        <p v-if="usage.user.resetAt" class="text-xs text-muted">Zurücksetzung: {{ new Date(usage.user.resetAt).toLocaleString('de-DE') }}</p>
      </div>
      <p v-else class="py-4 text-center text-muted">Keine Verbrauchsdaten verfügbar.</p>
    </UCard>
  </div>
</template>
