<script setup lang="ts">
// ============================================================================
// Token-Usage-Balken — visualisiert den KUMULATIVEN Tokenverbrauch des Nutzers
// im aktuellen Zeitraum gegen das aktuelle Limit.
//
// Limit-Resolution (Backend liefert das bereits aufgelöst):
//   1. Nutzer-Limit (admin-konfiguriert; harte Sperre via 429)
//   2. Tenant-Limit (admin-konfiguriert; harte Sperre via 429)
//   3. Anbieter-Quota (`connection.defaultUserMaxTokens`, admin-gepflegt;
//      weiches Default für scope='llm')
//   4. LLM-Kontextfenster (allerletzter Fallback; scope='llm')
//
// `usedTokens` ist IMMER der kumulierte Periodenverbrauch des Nutzers — auch
// bei scope='llm'. Wenn `maxTokens` nicht gesetzt ist (kein Limit irgendeiner
// Art), rendert die Komponente nichts.
//
// Tooltip auf Hover zeigt die exakten Zahlen, das Scope-Label und den Reset-Zeitpunkt.
// ============================================================================
import type { LtAiBudgetSummary } from '@lenne.tech/nuxt-extensions';

const props = defineProps<{
  budget?: LtAiBudgetSummary | null;
}>();

const isLlmScope = computed(() => props.budget?.scope === 'llm');
const max = computed(() => (typeof props.budget?.maxTokens === 'number' ? props.budget.maxTokens : 0));
const used = computed(() => (typeof props.budget?.usedTokens === 'number' ? props.budget.usedTokens : 0));

const remaining = computed(() => {
  if (typeof props.budget?.remainingTokens === 'number') {
    return props.budget.remainingTokens;
  }
  return Math.max(0, max.value - used.value);
});

const usedPercent = computed(() => (max.value > 0 ? Math.min(100, (used.value / max.value) * 100) : 0));

const scopeLabel = computed(() => {
  switch (props.budget?.scope) {
    case 'llm':
      return 'Anbieter-Quota (weich)';
    case 'tenant':
      return 'Tenant-Limit';
    case 'user':
      return 'Nutzer-Limit';
    default:
      return 'Limit';
  }
});

const resetAt = computed(() => (props.budget?.resetAt ? new Date(props.budget.resetAt).toLocaleString('de-DE') : ''));

// Color logic: green up to 50%, amber 50–85%, red above. For the LLM-soft scope
// we still color-code but the bar represents a guideline, not a hard cutoff.
const barClass = computed(() => {
  if (usedPercent.value >= 85) return 'bg-red-500';
  if (usedPercent.value >= 50) return 'bg-amber-500';
  return 'bg-emerald-500';
});

const visible = computed(() => max.value > 0);

const tooltipText = computed(() => {
  const lines = [
    `${scopeLabel.value}: ${max.value.toLocaleString('de-DE')} Tokens`,
    `Kumulativ${isLlmScope.value ? ' (weiches Limit)' : ''}: ${used.value.toLocaleString('de-DE')} (${usedPercent.value.toFixed(1)}%)`,
    `Übrig: ${remaining.value.toLocaleString('de-DE')}`,
  ];
  if (resetAt.value) lines.push(`Reset: ${resetAt.value}`);
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
