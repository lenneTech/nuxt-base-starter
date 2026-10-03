<script setup lang="ts">
import type { NuxtError } from '#app';

import { de } from '@nuxt/ui/locale';

defineProps<{
  error: NuxtError;
}>();

const appConfig: ReturnType<typeof useAppConfig> = useAppConfig();
</script>

<template>
  <!-- Nuxt renders this page INSTEAD of app.vue, so its UApp gets none of the
       props set there. Without them the error page reads "Back to home" and the
       toast region "Notifications" in an otherwise German UI. -->
  <UApp :locale="de" :toaster="appConfig.toaster">
    <UError :error="error" />
  </UApp>
</template>
