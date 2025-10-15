<script lang="ts" setup>
// ============================================================================
// Composables
// ============================================================================
const config = useRuntimeConfig();

// ============================================================================
// Variables
// ============================================================================
const features: Array<{
  color: 'info' | 'primary' | 'secondary' | 'success';
  description: string;
  icon: string;
  title: string;
}> = [
  {
    color: 'primary',
    description: 'Built with Vue 3 Composition API, TypeScript, and Nuxt 4 for modern development.',
    icon: 'i-lucide-rocket',
    title: 'Modern Stack',
  },
  {
    color: 'secondary',
    description: 'Pre-configured with Nuxt UI components, Tailwind CSS v4, and customizable themes.',
    icon: 'i-lucide-palette',
    title: 'UI Components',
  },
  {
    color: 'success',
    description: 'GraphQL and REST API support via @lenne.tech/nuxt-base with auto-generated types.',
    icon: 'i-lucide-database',
    title: 'API Ready',
  },
  {
    color: 'info',
    description: 'Form validation with VeeValidate and Valibot and state management with Pinia.',
    icon: 'i-lucide-check-circle',
    title: 'Production Ready',
  },
];

// ============================================================================
// Computed Properties
// ============================================================================
const isDevelopment = computed<boolean>(() => config.public.appEnv !== 'production');
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-neutral-950">
    <!-- Hero Section -->
    <div class="relative overflow-hidden">
      <div class="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div class="mx-auto max-w-3xl text-center">
          <div class="mb-8 flex items-center justify-center gap-x-3">
            <UBadge color="primary" variant="subtle" size="lg"> v4 </UBadge>
            <UBadge color="neutral" variant="outline" size="lg"> Nuxt Starter Template </UBadge>
          </div>
          <h1 class="text-5xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-6xl lg:text-7xl">
            Lenne Nuxt
            <span class="block text-primary mt-2">Base Template</span>
          </h1>
          <p class="mt-8 text-lg leading-8 text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
            A modern Nuxt 4 starter template with TypeScript, Nuxt UI components, and production-ready tools. Start building your next application with confidence.
          </p>
          <div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <UButton to="https://github.com/lenneTech/nuxt-base" target="_blank" size="xl" icon="i-lucide-github" color="primary"> View on GitHub </UButton>
            <UButton to="https://ui.nuxt.com" target="_blank" size="xl" variant="outline" color="neutral" trailing-icon="i-lucide-arrow-right"> Nuxt UI Docs </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Features Section -->
    <div class="mx-auto max-w-7xl px-6 py-16 lg:px-8">
      <div class="mx-auto max-w-2xl text-center mb-16">
        <h2 class="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">Features</h2>
        <p class="mt-4 text-lg text-neutral-600 dark:text-neutral-400">Everything you need to build modern web applications</p>
      </div>

      <div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <UCard v-for="feature in features" :key="feature.title" class="hover:shadow-lg transition-shadow">
          <template #header>
            <div class="flex items-center gap-3">
              <UBadge :icon="feature.icon" :color="feature.color" size="lg" square class="p-2" />
              <h3 class="font-semibold text-neutral-900 dark:text-white">
                {{ feature.title }}
              </h3>
            </div>
          </template>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            {{ feature.description }}
          </p>
        </UCard>
      </div>
    </div>

    <!-- Getting Started Section -->
    <div class="mx-auto max-w-7xl px-6 py-16 lg:px-8">
      <div class="space-y-8">
        <UAlert
          title="Getting Started"
          description="Run 'npm run dev' to start the development server on port 3001. Check CLAUDE.md for detailed documentation."
          icon="i-lucide-info"
          color="primary"
          variant="subtle"
        />

        <!-- Dev Examples Link (only in development) -->
        <UCard v-if="isDevelopment" variant="outline" class="border-2 border-primary/20">
          <template #header>
            <div class="flex items-center gap-3">
              <UBadge color="warning" variant="subtle" icon="i-lucide-flask-conical"> Development Only </UBadge>
              <h3 class="font-semibold text-neutral-900 dark:text-white">Interactive Examples</h3>
            </div>
          </template>

          <div class="space-y-4">
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              Explore interactive examples for all template components and composables. Perfect for learning and as a reference for new projects.
            </p>
            <div class="flex items-center gap-3">
              <UButton to="/dev-examples" icon="i-lucide-sparkles" trailing-icon="i-lucide-arrow-right" color="primary" size="md"> View Examples </UButton>
              <p class="text-xs text-neutral-500 dark:text-neutral-500">This link is only visible in development mode</p>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Footer Section -->
    <div class="mx-auto max-w-7xl px-6 py-16 lg:px-8">
      <div class="text-center">
        <p class="text-sm text-neutral-600 dark:text-neutral-400">
          Built with
          <ULink to="https://nuxt.com" target="_blank" class="font-medium text-primary"> Nuxt 4 </ULink>
          and
          <ULink to="https://ui.nuxt.com" target="_blank" class="font-medium text-primary"> Nuxt UI </ULink>
        </p>
      </div>
    </div>
  </div>
</template>
