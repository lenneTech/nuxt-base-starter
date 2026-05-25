<script setup lang="ts">
// ============================================================================
// Props
// ============================================================================
import type { LtAiBudgetSummary } from '@lenne.tech/nuxt-extensions';

const props = defineProps<{
  budget?: LtAiBudgetSummary | null;
}>();

// ============================================================================
// Computed
// ============================================================================
const hasLimit = computed(() => typeof props.budget?.remainingTokens === 'number');

const resetLabel = computed(() => {
  if (!props.budget?.resetAt) {
    return '';
  }
  return new Date(props.budget.resetAt).toLocaleString('de-DE');
});
</script>

<template>
  <UTooltip v-if="budget" :text="resetLabel ? `Zurücksetzung: ${resetLabel}` : 'Token-Verbrauch'">
    <UBadge color="neutral" variant="subtle" icon="i-lucide-coins">
      <template v-if="hasLimit"> {{ budget.remainingTokens }} Tokens übrig </template>
      <template v-else> {{ budget.usedTokens ?? 0 }} Tokens verbraucht </template>
    </UBadge>
  </UTooltip>
</template>
