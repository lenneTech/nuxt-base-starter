<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';

const headerItems = computed<NavigationMenuItem[]>(() => [
  {
    label: 'Docs',
    to: '#',
  },
  {
    label: 'Components',
    to: '#',
  },
  {
    label: 'Figma',
    target: '_blank',
    to: '#',
  },
  {
    label: 'Releases',
    target: '_blank',
    to: '#',
  },
]);

const footerItems: NavigationMenuItem[] = [
  {
    label: 'Figma Kit',
    target: '_blank',
    to: '#',
  },
  {
    label: 'Playground',
    target: '_blank',
    to: '#',
  },
  {
    label: 'Releases',
    target: '_blank',
    to: '#',
  },
];
</script>

<template>
  <div class="flex flex-col min-h-screen">
    <UHeader>
      <template #title>
        <UIcon name="i-lucide-code" class="text-primary" />
      </template>

      <UNavigationMenu :items="headerItems" />

      <template #right>
        <UColorModeButton />

        <UTooltip text="Open on GitHub" :kbds="['meta', 'G']">
          <UButton color="neutral" variant="ghost" to="https://github.com/lenneTech/nuxt-base-starter" target="_blank" icon="i-simple-icons-github" aria-label="GitHub" />
        </UTooltip>
      </template>
    </UHeader>
    <UMain>
      <slot></slot>
    </UMain>
    <USeparator icon="i-simple-icons-nuxtdotjs" type="dashed" class="h-px" />

    <UFooter>
      <template #left>
        <p class="text-muted text-sm">Copyright © {{ new Date().getFullYear() }}</p>
      </template>

      <UNavigationMenu :items="footerItems" variant="link" />

      <template #right>
        <UButton icon="i-simple-icons-discord" color="neutral" variant="ghost" to="#" target="_blank" aria-label="Discord" />
        <UButton icon="i-simple-icons-x" color="neutral" variant="ghost" to="#" target="_blank" aria-label="X" />
        <UButton icon="i-simple-icons-github" color="neutral" variant="ghost" to="#" target="_blank" aria-label="GitHub" />
      </template>
    </UFooter>
  </div>
</template>
