<script setup lang="ts">
// ============================================================================
// Token-Usage-Balken — visualisiert verbrauchte (links), verbleibende (rechts)
// und Gesamt-Tokens (volle Breite) für das aktuelle Limit.
//
// Limit-Resolution (Backend liefert das bereits aufgelöst): User-Limit →
// Tenant-Limit → LLM-Context-Window. Wenn `maxTokens` nicht gesetzt ist, gibt es
// kein effektives Limit → die Komponente rendert nichts.
//
// Tooltip auf Hover zeigt die exakten Zahlen, das Scope-Label und den Reset-Zeitpunkt.
// ============================================================================
import type { LtAiBudgetSummary } from '@lenne.tech/nuxt-extensions';

const props = defineProps<{
  budget?: LtAiBudgetSummary | null;
}>();

const max = computed(() => (typeof props.budget?.maxTokens === 'number' ? props.budget.maxTokens : 0));
const used = computed(() => (typeof props.budget?.usedTokens === 'number' ? props.budget.usedTokens : 0));
const remaining = computed(() => (typeof props.budget?.remainingTokens === 'number' ? props.budget.remainingTokens : Math.max(0, max.value - used.value)));
const usedPercent = computed(() => (max.value > 0 ? Math.min(100, (used.value / max.value) * 100) : 0));

const scopeLabel = computed(() => {
  switch (props.budget?.scope) {
    case 'llm':
      return 'LLM-Kontextfenster';
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
  const lines = [
    `${scopeLabel.value}: ${max.value.toLocaleString('de-DE')} Tokens`,
    `Verbraucht: ${used.value.toLocaleString('de-DE')} (${usedPercent.value.toFixed(1)}%)`,
    `Übrig: ${remaining.value.toLocaleString('de-DE')}`,
  ];
  if (resetAt.value) lines.push(`Reset: ${resetAt.value}`);
  return lines.join('\n');
});
</script>

<template>
  <UTooltip v-if="visible" :text="tooltipText" :delay-duration="100">
    <div class="flex items-center gap-2" :aria-label="tooltipText">
      <UIcon name="i-lucide-coins" class="size-4 shrink-0 text-muted" />
      <div class="relative h-2 w-32 overflow-hidden rounded-full bg-elevated">
        <div class="h-full rounded-full transition-all" :class="barClass" :style="{ width: usedPercent + '%' }" />
      </div>
      <span class="text-xs text-muted tabular-nums"> {{ used.toLocaleString('de-DE') }} / {{ max.toLocaleString('de-DE') }} </span>
    </div>
  </UTooltip>
</template>
