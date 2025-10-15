<script lang="ts" setup>
// ============================================================================
// Composables
// ============================================================================
const toast = useToast();
const colorMode = useColorMode();

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
    description: 'Form validation with VeeValidate and Zod and state management with Pinia.',
    icon: 'i-lucide-check-circle',
    title: 'Production Ready',
  },
];

const componentExamples: Array<{
  code: string;
  description: string;
  title: string;
}> = [
  {
    code: '<UButton color="primary" size="md">Click me</UButton>',
    description: 'Interactive buttons with multiple variants, sizes, and states.',
    title: 'Buttons',
  },
  {
    code: '<UAlert title="Info" description="This is an alert" />',
    description: 'Contextual alerts with customizable colors and icons.',
    title: 'Alerts',
  },
  {
    code: '<UCard><template #header>Title</template>Content</UCard>',
    description: 'Flexible cards with header, body, and footer slots.',
    title: 'Cards',
  },
];

// ============================================================================
// Functions
// ============================================================================
function showToast(type: 'error' | 'info' | 'success' | 'warning'): void {
  const messages: Record<string, { description: string; title: string }> = {
    error: { description: 'Something went wrong.', title: 'Error' },
    info: { description: 'Here is some information.', title: 'Info' },
    success: { description: 'Your action was successful!', title: 'Success' },
    warning: { description: 'Please be careful.', title: 'Warning' },
  };

  toast.add({
    color: type,
    description: messages[type].description,
    title: messages[type].title,
  });
}

function toggleColorMode(): void {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
}
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

    <!-- Components Demo Section -->
    <div class="mx-auto max-w-7xl px-6 py-16 lg:px-8">
      <div class="mx-auto max-w-2xl text-center mb-16">
        <h2 class="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">Nuxt UI Components</h2>
        <p class="mt-4 text-lg text-neutral-600 dark:text-neutral-400">Pre-built, customizable components ready to use</p>
      </div>

      <div class="grid grid-cols-1 gap-8 lg:grid-cols-3 mb-12">
        <UCard v-for="example in componentExamples" :key="example.title" variant="outline">
          <template #header>
            <h3 class="font-semibold text-neutral-900 dark:text-white">
              {{ example.title }}
            </h3>
          </template>
          <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
            {{ example.description }}
          </p>
          <div class="bg-neutral-100 dark:bg-neutral-900 rounded-lg p-3 mt-4">
            <code class="text-xs text-neutral-800 dark:text-neutral-300 break-all">
              {{ example.code }}
            </code>
          </div>
        </UCard>
      </div>

      <!-- Interactive Examples -->
      <div class="space-y-8">
        <UAlert
          title="Getting Started"
          description="Run 'npm run dev' to start the development server on port 3001. Check CLAUDE.md for detailed documentation."
          icon="i-lucide-info"
          color="primary"
          variant="subtle"
        />

        <UCard variant="outline">
          <template #header>
            <h3 class="font-semibold text-neutral-900 dark:text-white">Interactive Examples</h3>
          </template>

          <div class="space-y-6">
            <!-- Toast Notifications -->
            <div>
              <h4 class="text-sm font-medium text-neutral-900 dark:text-white mb-3">Toast Notifications</h4>
              <div class="flex flex-wrap gap-2">
                <UButton color="success" size="sm" @click="showToast('success')"> Success </UButton>
                <UButton color="error" size="sm" @click="showToast('error')"> Error </UButton>
                <UButton color="info" size="sm" @click="showToast('info')"> Info </UButton>
                <UButton color="warning" size="sm" @click="showToast('warning')"> Warning </UButton>
              </div>
            </div>

            <USeparator />

            <!-- Color Mode Toggle -->
            <div>
              <h4 class="text-sm font-medium text-neutral-900 dark:text-white mb-3">Color Mode</h4>
              <div class="flex items-center gap-4">
                <UButton :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'" color="neutral" variant="outline" size="sm" @click="toggleColorMode">
                  Toggle {{ colorMode.value === 'dark' ? 'Light' : 'Dark' }} Mode
                </UButton>
                <UBadge :color="colorMode.value === 'dark' ? 'primary' : 'warning'" size="md"> Current: {{ colorMode.value }} </UBadge>
              </div>
            </div>

            <USeparator />

            <!-- Badges -->
            <div>
              <h4 class="text-sm font-medium text-neutral-900 dark:text-white mb-3">Badges & Variants</h4>
              <div class="flex flex-wrap gap-2">
                <UBadge color="primary" variant="solid"> Primary </UBadge>
                <UBadge color="secondary" variant="solid"> Secondary </UBadge>
                <UBadge color="success" variant="outline"> Success </UBadge>
                <UBadge color="error" variant="soft"> Error </UBadge>
                <UBadge color="info" variant="subtle" icon="i-lucide-info"> Info </UBadge>
              </div>
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
