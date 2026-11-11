<script setup lang="ts">
// ============================================================================
// Admin: System / build identity (/app/admin/system).
// Protected by admin.global middleware (/app/admin/*).
//
// Shows the running App and API build (version + commit SHA) so a drifted /
// stale deployment can be spotted at a glance. The VERSION numbers are
// per-component and may legitimately differ. The COMMIT is the drift detector:
// both images bake it from the same CI commit, so a mismatch means a partial /
// stale rollout.
// ============================================================================
useHead({ title: 'System' });
definePageMeta({ ssr: false });

const { apiMeta, apiMetaFailed, appVersion, appCommit, buildsMatch, fetchApiMeta, fetchBuildIdentity, isLoadingMeta } = useSystem();
const apiHeading = useTemplateRef<HTMLHeadingElement>('apiHeading');

// API build identity, fetched from GET /meta. Falls back to placeholders while
// loading so the view never renders `undefined`.
const apiVersion = computed(() => apiMeta.value?.version || '–');
const apiCommit = computed(() => apiMeta.value?.commit || 'unknown');
const apiEnvironment = computed(() => apiMeta.value?.environment || '–');

onMounted(async () => {
  // Both sides in parallel — they are independent, and the comparison below
  // only makes sense once each has reported for itself.
  await Promise.all([fetchApiMeta(), fetchBuildIdentity()]);
});

// A failed GET /meta is an error, not an unknown commit: the drift check ignores `unknown` (a local
// build has none), so an API outage would otherwise look like a local build on the page meant to
// show a broken rollout. When a retry fails as well, the alert says so with the time and a status
// line announces it: in an outage the answer comes back at once, and an unchanged page would read
// as a button that does nothing. tests/e2e/admin-system.spec.ts walks all three states.
const retryFailedAt = ref<string>('');

const apiFailedDescription = computed<string>(() => {
  const base = 'Die API hat ihren Build-Stand nicht gemeldet. Ohne ihn lässt sich nicht prüfen, ob App und API zusammenpassen.';
  return retryFailedAt.value ? `${base} Letzter Versuch um ${retryFailedAt.value} Uhr: weiterhin keine Antwort.` : base;
});

const retryStatus = computed<string>(() => {
  if (isLoadingMeta.value) {
    return 'Wird erneut abgefragt …';
  }
  return retryFailedAt.value ? `Erneuter Versuch um ${retryFailedAt.value} Uhr fehlgeschlagen.` : '';
});

/** Retry GET /meta. On success the alert, and the focused button with it, disappears, so focus moves to the API row instead of dropping to <body>. */
async function retry(): Promise<void> {
  await fetchApiMeta();
  if (apiMetaFailed.value) {
    retryFailedAt.value = new Date().toLocaleTimeString('de-DE');
    return;
  }
  retryFailedAt.value = '';
  await nextTick();
  apiHeading.value?.focus();
}

/** Show the first 7 chars of a commit SHA, or a readable placeholder. */
function shortCommit(commit: string): string {
  if (!commit || commit === 'unknown') {
    return 'unbekannt';
  }
  return commit.slice(0, 7);
}
</script>

<template>
  <div class="mx-auto px-4 max-w-4xl space-y-6">
    <div>
      <h1 class="text-2xl font-bold">System</h1>
      <p class="text-muted">Build-Informationen von App und API.</p>
    </div>

    <!-- ====================================================================
         Versions / build identity
         The VERSION numbers are per-component and may legitimately differ —
         App and API are versioned independently. The COMMIT is the drift
         detector: both images bake it from the same CI commit, so a mismatch
         means a partial / stale rollout. Surfaced so it can be spotted at a
         glance instead of debugging "random" behaviour.
    ===================================================================== -->
    <section class="space-y-3">
      <h2 class="text-sm font-medium text-highlighted">Versionen</h2>

      <UAlert
        v-if="!buildsMatch"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="App und API laufen auf unterschiedlichen Builds"
        description="Die Commit-Stände von Frontend und Backend stimmen nicht überein. Das deutet auf ein unvollständiges oder veraltetes Deployment hin – bitte erneut ausrollen. (Unterschiedliche Versionsnummern allein sind dagegen normal.)"
      />

      <!-- The retry button stays mounted while it works (`apiMetaFailed` clears only on success), so a
           keyboard user keeps the focus; a second press during the request sends nothing (useSystem). -->
      <UAlert
        v-if="apiMetaFailed"
        color="error"
        variant="soft"
        icon="i-lucide-triangle-alert"
        title="API-Build nicht abrufbar"
        :description="apiFailedDescription"
        data-testid="system-api-failed"
      >
        <template #actions>
          <!-- Busy without `disabled`: a disabled button would drop the keyboard focus to <body>.
               A darker label than the soft variant's `text-error`: on hover the button's tint stacks on
               the alert's own, and the theme's error step falls below 4.5:1 there. error-800 in light
               mode, error-300 in dark mode; measured on hover in the browser (see the commit). -->
          <UButton
            color="error"
            variant="soft"
            size="sm"
            label="Erneut versuchen"
            :icon="isLoadingMeta ? 'i-lucide-loader-circle' : 'i-lucide-refresh-cw'"
            :aria-busy="isLoadingMeta || undefined"
            :ui="{ base: 'text-error-800 dark:text-error-300', leadingIcon: isLoadingMeta ? 'animate-spin' : '' }"
            @click="retry"
          />
        </template>
      </UAlert>
      <p class="sr-only" role="status">{{ retryStatus }}</p>

      <UCard>
        <div class="flex items-center justify-between gap-4">
          <div>
            <h3 class="text-sm font-normal text-highlighted">App (Frontend)</h3>
            <div class="text-xs text-muted">Version {{ appVersion }}</div>
          </div>
          <UBadge color="neutral" variant="subtle" :title="appCommit">{{ shortCommit(appCommit) }}</UBadge>
        </div>

        <USeparator class="my-4" />

        <div class="flex items-center justify-between gap-4">
          <div>
            <h3 ref="apiHeading" class="text-sm font-normal text-highlighted outline-none" tabindex="-1">API (Backend)</h3>
            <div v-if="apiMetaFailed" class="text-xs text-muted">Keine Angaben, solange die API nicht antwortet.</div>
            <div v-else class="text-xs text-muted">Version {{ apiVersion }} · Umgebung {{ apiEnvironment }}</div>
          </div>
          <div class="flex items-center gap-2">
            <UIcon v-if="isLoadingMeta" name="i-lucide-loader-2" class="size-4 animate-spin text-muted" />
            <UBadge v-if="!apiMetaFailed" :color="buildsMatch ? 'neutral' : 'warning'" variant="subtle" :title="apiCommit" data-testid="system-api-commit">{{
              shortCommit(apiCommit)
            }}</UBadge>
          </div>
        </div>
      </UCard>
    </section>
  </div>
</template>
