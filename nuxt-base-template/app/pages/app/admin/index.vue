<script setup lang="ts">
// ============================================================================
// Admin dashboard — entry point for admin-only areas (/app/admin/*).
// ============================================================================
useHead({ title: 'Administration' });

const cards = [
  { description: 'LLM-Verbindungen verwalten + Fähigkeiten erkennen', icon: 'i-lucide-plug', title: 'KI-Verbindungen', to: '/app/admin/ai/connections' },
  { description: 'Standard-Verbindung pro Tenant/Nutzer', icon: 'i-lucide-list-checks', title: 'KI-Präferenzen', to: '/app/admin/ai/preferences' },
  { description: 'Token-/Anfrage-Limits', icon: 'i-lucide-gauge', title: 'KI-Budgets', to: '/app/admin/ai/budgets' },
  { description: 'Protokoll der Prompt-Läufe', icon: 'i-lucide-scroll-text', title: 'KI-Audit-Log', to: '/app/admin/ai/interactions' },
];
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Administration</h1>
      <p class="text-muted">Verwaltungsbereiche für Administratoren.</p>
    </div>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <ULink v-for="card in cards" :key="card.to" :to="card.to" class="block">
        <UCard class="h-full transition hover:ring-2 hover:ring-primary">
          <div class="flex items-start gap-3">
            <UIcon :name="card.icon" class="size-6 shrink-0 text-primary" />
            <div>
              <h2 class="font-semibold">{{ card.title }}</h2>
              <p class="text-sm text-muted">{{ card.description }}</p>
            </div>
          </div>
        </UCard>
      </ULink>
    </div>
  </div>
</template>
