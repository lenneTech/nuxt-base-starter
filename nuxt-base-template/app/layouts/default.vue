<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';

const { isAuthenticated, signOut, user, validateSession } = useLtAuth();

onMounted(() => {
  validateSession();
});

async function handleLogout() {
  await signOut();
  await navigateTo('/auth/login');
}

// nest-server users carry roles as an array (`roles: string[]`); some Better Auth
// setups additionally expose a singular `role`. Accept either so the admin nav
// shows up regardless of the auth shape.
const isAdmin = computed(() => {
  const u = user.value as { role?: string; roles?: string[] } | null;
  return !!u?.roles?.includes('admin') || u?.role === 'admin';
});

const headerItems = computed<NavigationMenuItem[]>(() => {
  if (!isAuthenticated.value) {
    return [{ label: 'Docs', to: '#' }];
  }
  const items: NavigationMenuItem[] = [
    { icon: 'i-lucide-sparkles', label: 'KI-Assistent', to: '/app/ai' },
    { icon: 'i-lucide-clipboard-list', label: 'KI-Vorlagen', to: '/app/settings/ai-snippets' },
    { icon: 'i-lucide-settings', label: 'KI-Einstellungen', to: '/app/settings/ai' },
  ];
  if (isAdmin.value) {
    items.push({ icon: 'i-lucide-shield', label: 'Administration', to: '/app/admin' });
  }
  return items;
});

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
        <template v-if="isAuthenticated">
          <span class="text-sm text-muted hidden sm:inline">{{ user?.email }}</span>
          <UTooltip text="Logout">
            <UButton color="neutral" variant="ghost" icon="i-lucide-log-out" aria-label="Logout" @click="handleLogout" />
          </UTooltip>
        </template>
        <template v-else>
          <UButton color="primary" variant="soft" to="/auth/login" icon="i-lucide-log-in" label="Login" />
        </template>

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
