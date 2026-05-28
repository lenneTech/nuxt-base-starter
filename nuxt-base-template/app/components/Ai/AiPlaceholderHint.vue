<script setup lang="ts">
// ============================================================================
// Placeholder helper sidebar — lists every `{{placeholder}}` the backend
// supports (registry-driven, so project-specific additions are picked up
// automatically). Click copies the token to the clipboard.
// ============================================================================
const toast = useToast();
const { error, load, loading, placeholders } = useLtAiPlaceholders();

onMounted(load);

function token(name: string): string {
  return '{' + '{' + name + '}' + '}';
}

async function copy(name: string): Promise<void> {
  const t = token(name);
  try {
    await navigator.clipboard.writeText(t);
    toast.add({ color: 'success', description: `${t} kopiert`, title: 'Platzhalter' });
  } catch {
    toast.add({ color: 'error', description: 'Zwischenablage nicht verfügbar', title: 'Fehler' });
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-braces" class="size-4" />
        <h3 class="font-semibold">Verfügbare Platzhalter</h3>
      </div>
    </template>
    <p class="mb-3 text-xs text-muted">Tokens wie <code>&#123;&#123;name&#125;&#125;</code> werden zur Laufzeit ersetzt. Klick auf einen Eintrag kopiert ihn.</p>
    <div v-if="loading" class="py-4 text-center text-muted">
      <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" />
    </div>
    <UAlert v-else-if="error" color="error" variant="subtle" icon="i-lucide-alert-circle" :description="error" />
    <div v-else-if="!placeholders.length" class="py-2 text-xs text-muted">Keine Platzhalter verfügbar.</div>
    <ul v-else class="space-y-2">
      <li v-for="p in placeholders" :key="p.name" class="cursor-pointer rounded p-2 hover:bg-elevated" :title="p.example || ''" @click="copy(p.name)">
        <div class="flex items-center gap-2">
          <UBadge size="xs" variant="subtle">{{ token(p.name) }}</UBadge>
          <UIcon name="i-lucide-copy" class="size-3 text-muted" />
        </div>
        <p class="mt-1 text-xs text-muted">{{ p.description }}</p>
      </li>
    </ul>
  </UCard>
</template>
