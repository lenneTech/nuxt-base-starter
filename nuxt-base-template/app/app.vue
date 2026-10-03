<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import { de } from '@nuxt/ui/locale';

// ============================================================================
// Composables
// ============================================================================
const appConfig: ReturnType<typeof useAppConfig> = useAppConfig();
const siteConfig = useSiteConfig();

// ============================================================================
// Head
// ============================================================================
// nuxt-seo-utils appends the site name to every title — including the default
// title, which IS the site name, so a page without its own title read
// "Nuxt Base Starter | Nuxt Base Starter" in the tab and every bookmark. Its
// template has low priority, so this one replaces it. It returns template params
// rather than a finished string, so a separator set in `site` still applies.
useHead({
  titleTemplate: (title?: null | string): string => (!title || title === siteConfig.name ? '%siteName' : '%s %separator %siteName'),
});
</script>

<template>
  <!-- `locale`: Nuxt UI's own texts ("Schließen", "Passwort anzeigen", empty
       states) in German like the rest of the UI. Without it they are English,
       and a screen reader announces German pages with English control names. -->
  <UApp :locale="de" :toaster="appConfig.toaster">
    <NuxtLoadingIndicator color="var(--ui-primary)" :height="2" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
