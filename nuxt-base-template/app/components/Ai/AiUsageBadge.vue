<script setup lang="ts">
// ============================================================================
// Token-usage badge — zeigt den Verbrauch der LETZTEN Anfrage (promptTokens).
// Der kumulierte Periodenverbrauch (usedTokens) wird vom Token-Bar abgedeckt.
// Tooltip zeigt das Reset-Datum, wenn eine Periode aktiv ist.
// ============================================================================
import type { LtAiBudgetSummary } from '@lenne.tech/nuxt-extensions';

const props = defineProps<{
  budget?: LtAiBudgetSummary | null;
}>();

const label = computed(() => {
  const tokens = props.budget?.promptTokens;
  if (typeof tokens !== 'number') {
    return '';
  }
  return `${tokens.toLocaleString('de-DE')} Tokens (letzte Anfrage)`;
});

const resetLabel = computed(() => {
  if (!props.budget?.resetAt) {
    return '';
  }
  return new Date(props.budget.resetAt).toLocaleString('de-DE');
});
</script>

<template>
  <UTooltip v-if="label" :text="resetLabel ? `Periode endet: ${resetLabel}` : 'Tokens der letzten Anfrage'">
    <UBadge color="neutral" variant="subtle" icon="i-lucide-coins">{{ label }}</UBadge>
  </UTooltip>
</template>
