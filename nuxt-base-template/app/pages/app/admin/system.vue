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

const { apiMeta, appVersion, appCommit, buildsMatch, fetchApiMeta, fetchBuildIdentity, isLoadingMeta } = useSystem();

// API build identity, fetched from GET /meta. Falls back to placeholders while
// loading / when unreachable so the view never renders `undefined`.
const apiVersion = computed(() => apiMeta.value?.version || '–');
const apiCommit = computed(() => apiMeta.value?.commit || 'unknown');
const apiEnvironment = computed(() => apiMeta.value?.environment || '–');

onMounted(async () => {
  // Both sides in parallel — they are independent, and the comparison below
  // only makes sense once each has reported for itself.
  await Promise.all([fetchApiMeta(), fetchBuildIdentity()]);
});

/** Show the first 7 chars of a commit SHA, or a readable placeholder. */
function shortCommit(commit: string): string {
  if (!commit || commit === 'unknown') {
    return 'unbekannt';
  }
  return commit.slice(0, 7);
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
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

      <UCard>
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-sm text-highlighted">App (Frontend)</div>
            <div class="text-xs text-muted">Version {{ appVersion }}</div>
          </div>
          <UBadge color="neutral" variant="subtle" :title="appCommit">{{ shortCommit(appCommit) }}</UBadge>
        </div>

        <USeparator class="my-4" />

        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-sm text-highlighted">API (Backend)</div>
            <div class="text-xs text-muted">Version {{ apiVersion }} · Umgebung {{ apiEnvironment }}</div>
          </div>
          <div class="flex items-center gap-2">
            <UIcon v-if="isLoadingMeta" name="i-lucide-loader-2" class="size-4 animate-spin text-muted" />
            <UBadge :color="buildsMatch ? 'neutral' : 'warning'" variant="subtle" :title="apiCommit">{{ shortCommit(apiCommit) }}</UBadge>
          </div>
        </div>
      </UCard>
    </section>
  </div>
</template>
