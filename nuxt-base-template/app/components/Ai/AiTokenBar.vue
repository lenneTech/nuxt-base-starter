<script setup lang="ts">
// ============================================================================
// Token usage bar — cumulative period usage against the current limit. A
// click opens a popover with all details (source of the limit, cumulative
// usage, remaining, last request, reset).
//
// Limit resolution (the backend resolves this; the bar just renders it):
//   1. User limit       (admin-configured; hard 429 on overflow)
//   2. Tenant limit     (admin-configured; hard 429 on overflow)
//   3. Provider quota   (`connection.defaultUserMaxTokens`, admin-pinned;
//                        soft default for scope='llm')
//   4. LLM context window  (last-resort soft default; scope='llm')
//
// `usedTokens` is ALWAYS the running per-period total — including scope='llm'.
// When `maxTokens` isn't set (no limit of any kind) the component renders nothing.
// ============================================================================
import type { LtAiBudgetSummary } from '@lenne.tech/nuxt-extensions';

const props = defineProps<{
  budget?: LtAiBudgetSummary | null;
}>();

const isLlmScope = computed(() => props.budget?.scope === 'llm');
const max = computed(() => (typeof props.budget?.maxTokens === 'number' ? props.budget.maxTokens : 0));
const used = computed(() => (typeof props.budget?.usedTokens === 'number' ? props.budget.usedTokens : 0));
const lastRequest = computed(() => (typeof props.budget?.promptTokens === 'number' ? props.budget.promptTokens : 0));

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

const scopeDescription = computed(() => {
  switch (props.budget?.scope) {
    case 'llm':
      return 'Vom Anbieter / Kontextfenster abgeleitete weiche Obergrenze — kein hartes 429.';
    case 'tenant':
      return 'Vom Admin konfiguriertes Token-Limit pro Tenant. Bei Überschreitung antwortet das Backend mit 429.';
    case 'user':
      return 'Vom Admin konfiguriertes Token-Limit pro Nutzer. Bei Überschreitung antwortet das Backend mit 429.';
    default:
      return '';
  }
});

const resetAt = computed(() => (props.budget?.resetAt ? new Date(props.budget.resetAt).toLocaleString('de-DE') : ''));

// Color logic: green up to 50%, amber 50–85%, red above.
const barClass = computed(() => {
  if (usedPercent.value >= 85) return 'bg-red-500';
  if (usedPercent.value >= 50) return 'bg-amber-500';
  return 'bg-emerald-500';
});

const visible = computed(() => max.value > 0);

function fmt(n: number): string {
  return n.toLocaleString('de-DE');
}
</script>

<template>
  <UPopover v-if="visible" :ui="{ content: 'w-80' }">
    <button
      type="button"
      class="flex cursor-pointer items-center gap-2 rounded outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-primary"
      aria-label="Token-Verbrauch anzeigen"
    >
      <UIcon name="i-lucide-coins" class="size-4 shrink-0 text-muted" />
      <div class="relative h-2 w-32 overflow-hidden rounded-full bg-elevated">
        <div class="h-full rounded-full transition-all" :class="barClass" :style="{ width: usedPercent + '%' }" />
      </div>
      <span class="text-xs text-muted tabular-nums">{{ fmt(used) }} / {{ fmt(max) }}</span>
      <UIcon name="i-lucide-info" class="size-3 text-muted" />
    </button>
    <template #content>
      <div class="p-4 text-sm">
        <p class="mb-1 font-semibold">{{ scopeLabel }}</p>
        <p v-if="scopeDescription" class="mb-3 text-xs text-muted">{{ scopeDescription }}</p>
        <dl class="space-y-2">
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-muted">Limit</dt>
            <dd class="tabular-nums font-medium">{{ fmt(max) }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-muted">Verbraucht (kumulativ)</dt>
            <dd class="tabular-nums font-medium">
              {{ fmt(used) }} <span class="text-muted">({{ usedPercent.toFixed(1) }}%)</span>
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-muted">Übrig</dt>
            <dd class="tabular-nums font-medium">{{ fmt(remaining) }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-3 border-t pt-2">
            <dt class="text-muted">Letzte Anfrage</dt>
            <dd class="tabular-nums font-medium">{{ fmt(lastRequest) }}</dd>
          </div>
          <div v-if="resetAt" class="flex items-baseline justify-between gap-3">
            <dt class="text-muted">{{ isLlmScope ? 'Periode endet' : 'Reset' }}</dt>
            <dd class="text-xs">{{ resetAt }}</dd>
          </div>
        </dl>
      </div>
    </template>
  </UPopover>
</template>
