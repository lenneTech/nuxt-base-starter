<script setup lang="ts">
// ============================================================================
// Token-usage badge. The server only sends a finite `remainingTokens`/`usedTokens`
// when a budget limit applies. For unlimited users it sends just `promptTokens`
// (the last turn's cost), so fall back to that instead of showing "0 verbraucht".
// ============================================================================
import type { LtAiBudgetSummary } from '@lenne.tech/nuxt-extensions';

const props = defineProps<{
  budget?: LtAiBudgetSummary | null;
}>();

// ============================================================================
// Computed
// ============================================================================
const label = computed(() => {
  const b = props.budget;
  if (!b) {
    return '';
  }
  if (typeof b.remainingTokens === 'number') {
    return `${b.remainingTokens} Tokens übrig`;
  }
  if (typeof b.usedTokens === 'number') {
    return `${b.usedTokens} Tokens verbraucht`;
  }
  if (typeof b.promptTokens === 'number') {
    return `${b.promptTokens} Tokens (letzte Anfrage)`;
  }
  return '';
});

const resetLabel = computed(() => {
  if (!props.budget?.resetAt) {
    return '';
  }
  return new Date(props.budget.resetAt).toLocaleString('de-DE');
});
</script>

<template>
  <UTooltip v-if="label" :text="resetLabel ? `Zurücksetzung: ${resetLabel}` : 'Token-Verbrauch'">
    <UBadge color="neutral" variant="subtle" icon="i-lucide-coins">{{ label }}</UBadge>
  </UTooltip>
</template>
