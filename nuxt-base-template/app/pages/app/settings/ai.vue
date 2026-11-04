<script setup lang="ts">
// ============================================================================
// User AI settings: pick the personal default connection, switch the MCP
// confirmation, and view token usage.
// ============================================================================
useHead({ title: 'KI-Einstellungen' });
definePageMeta({ ssr: false });

const toast = useToast();
const { translateError } = useLtErrorTranslation();
const { connections, load: loadConnections, locked, select, selected } = useLtAiConnections();
const { enforced, error: settingsError, load: loadSettings, loading: settingsLoading, settings, update: updateSettings } = useLtAiSettings();
const { load: loadUsage, usage } = useLtAiUsage();
// The MCP card only while the API runs an MCP server (`GET /ai/status`, loaded by ai.global.ts):
// without one the switch would change a setting nothing reads.
const { mcp } = useLtAiStatus();

onMounted(async () => {
  await Promise.all([loadConnections(), mcp.value ? loadSettings() : undefined, loadUsage()]);
});

async function choose(id: string): Promise<void> {
  try {
    await select(id);
    toast.add({ color: 'success', description: 'Standard-Verbindung gespeichert.', title: 'Erfolg' });
  } catch (err) {
    toast.add({ color: 'error', description: (err as Error).message, title: 'Fehler' });
  }
}

// Off is the "bypass permissions" mode: MCP clients run destructive tools in this user's name
// without asking (nest-server 12.3.0). A refusal (403 #LTNS_0609 while the server enforces the
// value, an expired session, a 5xx) leaves `settings` unchanged, and the switch shows `settings`.
async function setMcpConfirmation(value: boolean): Promise<void> {
  try {
    await updateSettings({ mcpConfirmation: value });
    toast.add({ color: 'success', description: value ? 'MCP-Rückfrage eingeschaltet.' : 'MCP-Rückfrage ausgeschaltet.', title: 'Erfolg' });
  } catch (err) {
    toast.add({ color: 'error', description: translateError((err as Error).message), title: 'Fehler' });
  }
}

function pct(used: number, max?: number): number {
  return max && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
}
</script>

<template>
  <div class="mx-auto px-4 max-w-2xl space-y-8">
    <div>
      <h1 class="text-2xl font-bold">KI-Einstellungen</h1>
      <p class="text-muted">Wähle deine bevorzugte KI-Verbindung<template v-if="mcp">, lege die MCP-Rückfrage fest</template> und sieh deinen Verbrauch.</p>
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

    <!-- MCP confirmation -->
    <UCard v-if="mcp">
      <template #header>
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-shield-check" class="size-6 text-primary" />
          <div>
            <h2 class="font-semibold">MCP-Rückfrage</h2>
            <p class="text-sm text-muted">Für KI-Clients wie Claude Desktop oder Claude Code, die über MCP in deinem Namen arbeiten</p>
          </div>
        </div>
      </template>

      <div class="space-y-3">
        <UAlert v-if="enforced" color="info" variant="subtle" icon="i-lucide-lock" description="Die Einstellung ist vom Server festgelegt und kann nicht geändert werden." />
        <!-- Mounted only once the settings are there: reka-ui's SwitchRoot decides at setup whether
             it is controlled, and mounted with `undefined` it keeps its own state, so a refused
             change would leave the switch showing a value the server does not hold. -->
        <USwitch
          v-if="settings"
          :model-value="settings.mcpConfirmation"
          :disabled="enforced"
          :loading="settingsLoading"
          label="Vor destruktiven Aktionen nachfragen"
          description="Bevor ein MCP-Client in deinem Namen zum Beispiel Daten löscht, fragt er dich. Der Chat in der App und andere Nutzer sind davon nicht betroffen."
          @update:model-value="setMcpConfirmation"
        />
        <UAlert
          v-if="settings?.mcpConfirmation === false"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Rückfrage ausgeschaltet"
          description="Destruktive Aktionen werden über MCP ohne Rückfrage ausgeführt. Die Rechte deines Kontos und die Regeln der Administration gelten weiterhin."
        />
        <p v-if="!settings && settingsError" class="text-sm text-muted">Die Einstellung ist gerade nicht verfügbar.</p>
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
