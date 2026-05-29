<script setup lang="ts">
// ============================================================================
// Token-Usage-Balken — visualisiert verbrauchte (links), verbleibende (rechts)
// und Gesamt-Tokens (volle Breite) für das aktuelle Limit.
//
// Limit-Resolution (Backend liefert das bereits aufgelöst): User-Limit →
// Tenant-Limit → LLM-Context-Window. Wenn `maxTokens` nicht gesetzt ist, gibt es
// kein effektives Limit → die Komponente rendert nichts.
//
// Wenn `scope === 'llm'` (kein echtes Budget, nur Context-Window), zeigt der
// Balken die Tokens der LETZTEN Anfrage gegen das Context-Window — kumulativer
// `usedTokens` ist hier per Definition immer 0, der relevante Wert ist
// `promptTokens`. Bei user/tenant zählt der kumulierte Periodenverbrauch.
//
// Tooltip auf Hover zeigt die exakten Zahlen, das Scope-Label und den Reset-Zeitpunkt.
// ============================================================================
import type { LtAiBudgetSummary } from '@lenne.tech/nuxt-extensions';

const props = defineProps<{
  budget?: LtAiBudgetSummary | null;
}>();

const isLlmScope = computed(() => props.budget?.scope === 'llm');
const max = computed(() => (typeof props.budget?.maxTokens === 'number' ? props.budget.maxTokens : 0));

// For LLM-context-window scope, the bar shows the LAST request against the window
// (cumulative `usedTokens` is always 0 in that case). For user/tenant budgets it's
// the running per-period total.
const used = computed(() => {
  if (isLlmScope.value) {
    return typeof props.budget?.promptTokens === 'number' ? props.budget.promptTokens : 0;
  }
  return typeof props.budget?.usedTokens === 'number' ? props.budget.usedTokens : 0;
});

const remaining = computed(() => {
  if (typeof props.budget?.remainingTokens === 'number' && !isLlmScope.value) {
    return props.budget.remainingTokens;
  }
  return Math.max(0, max.value - used.value);
});

const usedPercent = computed(() => (max.value > 0 ? Math.min(100, (used.value / max.value) * 100) : 0));

const scopeLabel = computed(() => {
  switch (props.budget?.scope) {
    case 'llm':
      return 'LLM-Kontextfenster (letzte Anfrage)';
    case 'tenant':
      return 'Tenant-Limit';
    case 'user':
      return 'Nutzer-Limit';
    default:
      return 'Limit';
  }
});

const resetAt = computed(() => (props.budget?.resetAt ? new Date(props.budget.resetAt).toLocaleString('de-DE') : ''));

// Color logic: green up to 50%, amber 50–85%, red above
const barClass = computed(() => {
  if (usedPercent.value >= 85) return 'bg-red-500';
  if (usedPercent.value >= 50) return 'bg-amber-500';
  return 'bg-emerald-500';
});

const visible = computed(() => max.value > 0);

const tooltipText = computed(() => {
  const usedLabel = isLlmScope.value ? 'Letzte Anfrage' : 'Verbraucht';
  const lines = [
    `${scopeLabel.value}: ${max.value.toLocaleString('de-DE')} Tokens`,
    `${usedLabel}: ${used.value.toLocaleString('de-DE')} (${usedPercent.value.toFixed(1)}%)`,
    `Übrig: ${remaining.value.toLocaleString('de-DE')}`,
  ];
  if (resetAt.value && !isLlmScope.value) lines.push(`Reset: ${resetAt.value}`);
  return lines.join('\n');
});
</script>

<template>
  <UTooltip v-if="visible" :text="tooltipText" :delay-duration="100">
    <div class="flex items-center gap-2">
      <UIcon name="i-lucide-coins" class="size-4 shrink-0 text-muted" />
      <div class="relative h-2 w-32 overflow-hidden rounded-full bg-elevated">
        <div class="h-full rounded-full transition-all" :class="barClass" :style="{ width: usedPercent + '%' }" />
      </div>
      <span class="text-xs text-muted tabular-nums">{{ used.toLocaleString('de-DE') }} / {{ max.toLocaleString('de-DE') }}</span>
    </div>
  </UTooltip>
</template>
