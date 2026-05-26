<script setup lang="ts">
// ============================================================================
// Context-Window-Indikator — schließender Kreis im Claude-Code-Stil. Erscheint
// erst ab 60% Nutzung; bei 100% ist der Kreis voll geschlossen. Tooltip auf
// Hover zeigt den exakten Prozentsatz und die Token-Werte.
// ============================================================================
const props = defineProps<{
  contextWindow?: { total: number; used: number } | null;
}>();

const percent = computed(() => {
  const cw = props.contextWindow;
  if (!cw || cw.total <= 0) return 0;
  return Math.min(100, (cw.used / cw.total) * 100);
});

const visible = computed(() => !!props.contextWindow && percent.value >= 60);

// SVG arc: full = 100%, empty = 0%. Stroke-dashoffset goes from circumference (empty) to 0 (full).
const radius = 8;
const circumference = computed(() => 2 * Math.PI * radius);
const dashOffset = computed(() => circumference.value * (1 - percent.value / 100));

const ringClass = computed(() => {
  if (percent.value >= 90) return 'text-red-500';
  if (percent.value >= 75) return 'text-amber-500';
  return 'text-primary';
});

const tooltipText = computed(() => {
  const cw = props.contextWindow!;
  return [`Kontextfenster: ${percent.value.toFixed(1)}% genutzt`, `Verbraucht: ${cw.used.toLocaleString('de-DE')} / ${cw.total.toLocaleString('de-DE')} Tokens`].join('\n');
});
</script>

<template>
  <UTooltip v-if="visible" :text="tooltipText" :delay-duration="100">
    <div class="inline-flex size-6 items-center justify-center" role="img" :aria-label="`Kontextfenster ${percent.toFixed(0)}% genutzt`">
      <svg viewBox="0 0 20 20" class="size-5 -rotate-90" :class="ringClass">
        <!-- background ring -->
        <circle cx="10" cy="10" :r="radius" fill="none" stroke="currentColor" stroke-opacity="0.15" stroke-width="2.5" />
        <!-- progress arc -->
        <circle
          cx="10"
          cy="10"
          :r="radius"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashOffset"
          class="transition-[stroke-dashoffset] duration-300"
        />
      </svg>
    </div>
  </UTooltip>
</template>
