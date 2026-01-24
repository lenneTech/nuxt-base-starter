<script setup lang="ts">
import type { LtUploadItem } from '@lenne.tech/nuxt-extensions';

// ============================================================================
// Props & Emits
// ============================================================================
interface Props {
  /** Erlaubte Dateitypen (MIME types oder Extensions) */
  accept?: string;
  /** Upload automatisch starten */
  autoStart?: boolean;
  /** Chunk-Groesse fuer TUS */
  chunkSize?: number;
  /** Beschreibung fuer Dropzone */
  description?: string;
  /** Deaktiviert */
  disabled?: boolean;
  /** TUS Upload Endpoint */
  endpoint?: string;
  /** Label fuer Dropzone */
  label?: string;
  /** Layout der Dateiliste */
  layout?: 'grid' | 'list';
  /** Maximale Dateigroesse in Bytes */
  maxSize?: number;
  /** Zusaetzliche Metadaten */
  metadata?: Record<string, string>;
  /** Mehrere Dateien erlauben */
  multiple?: boolean;
  /** Parallele Uploads */
  parallelUploads?: number;
}

const props = withDefaults(defineProps<Props>(), {
  accept: '*/*',
  autoStart: true,
  chunkSize: 5 * 1024 * 1024,
  description: 'Dateien werden automatisch hochgeladen',
  label: 'Dateien hier ablegen',
  layout: 'list',
  maxSize: 100 * 1024 * 1024,
  multiple: true,
  parallelUploads: 3,
});

const emit = defineEmits<{
  /** Alle Uploads abgeschlossen */
  complete: [items: LtUploadItem[]];
  /** Upload-Fehler */
  error: [item: LtUploadItem, error: Error];
  /** Ein Upload abgeschlossen */
  success: [item: LtUploadItem];
  /** Files geaendert */
  'update:modelValue': [files: File[]];
}>();

// ============================================================================
// Composables
// ============================================================================
const toast = useToast();
const { formatDuration, formatFileSize } = useLtFile();

// ============================================================================
// TUS Upload Setup
// ============================================================================
const { addFiles, cancelAll, cancelUpload, clearCompleted, isUploading, pauseAll, pauseUpload, resumeAll, resumeUpload, retryUpload, totalProgress, uploads } = useLtTusUpload({
  autoStart: props.autoStart,
  chunkSize: props.chunkSize,
  endpoint: props.endpoint,
  metadata: props.metadata,
  onError: (item, error) => {
    toast.add({
      color: 'error',
      description: item.file.name,
      title: 'Upload fehlgeschlagen',
    });
    emit('error', item, error);
  },
  onSuccess: (item) => {
    toast.add({
      color: 'success',
      description: item.file.name,
      title: 'Upload abgeschlossen',
    });
    emit('success', item);
  },
  parallelUploads: props.parallelUploads,
});

// ============================================================================
// State
// ============================================================================
const files = ref<File[]>([]);

// ============================================================================
// Watchers
// ============================================================================
// Neue Dateien zu TUS hinzufuegen
watch(
  files,
  (newFiles, oldFiles) => {
    const addedFiles = newFiles.filter((f) => !oldFiles?.includes(f));
    if (addedFiles.length > 0) {
      // Validierung
      const validFiles = addedFiles.filter((file) => {
        if (file.size > props.maxSize) {
          toast.add({
            color: 'error',
            description: `${file.name} ist zu gross (max. ${formatFileSize(props.maxSize)})`,
            title: 'Datei zu gross',
          });
          return false;
        }
        return true;
      });

      if (validFiles.length > 0) {
        addFiles(validFiles);
      }
    }
    emit('update:modelValue', newFiles);
  },
  { deep: true },
);

// Emit complete wenn alle fertig
const completedUploads = computed(() => uploads.value.filter((u) => u.status === 'completed'));
watch([completedUploads, isUploading], ([completed, uploading]) => {
  if (completed.length > 0 && !uploading && uploads.value.every((u) => u.status === 'completed' || u.status === 'error')) {
    emit('complete', completed);
  }
});

function getStatusColor(status: string): 'error' | 'neutral' | 'success' | 'warning' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'error':
      return 'error';
    case 'paused':
      return 'warning';
    default:
      return 'neutral';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Fertig';
    case 'error':
      return 'Fehler';
    case 'paused':
      return 'Pausiert';
    case 'uploading':
      return 'Hochladen';
    default:
      return 'Wartend';
  }
}

// ============================================================================
// Helpers
// ============================================================================
function getUploadForFile(file: File, index: number): undefined | LtUploadItem {
  // Versuche ueber Index zu matchen (funktioniert wenn Reihenfolge gleich)
  const upload = uploads.value[index];
  if (upload?.file.name === file.name && upload?.file.size === file.size) {
    return upload;
  }
  // Fallback: Suche ueber Name und Groesse
  return uploads.value.find((u) => u.file.name === file.name && u.file.size === file.size);
}

// ============================================================================
// Expose fuer Parent-Zugriff
// ============================================================================
defineExpose({
  cancelAll,
  clearCompleted,
  isUploading,
  pauseAll,
  resumeAll,
  totalProgress,
  uploads,
});
</script>

<template>
  <div class="space-y-4">
    <!-- Nuxt UI FileUpload -->
    <UFileUpload
      v-model="files"
      :accept="accept"
      :description="description"
      :disabled="disabled || isUploading"
      :dropzone="!disabled"
      :label="label"
      :layout="layout"
      :multiple="multiple"
      class="w-full"
    >
      <!-- Custom File Slot mit TUS Progress -->
      <template #file="{ file, index }">
        <div class="flex w-full items-center gap-3 rounded-lg border border-default bg-default p-3">
          <UIcon name="i-lucide-file" class="size-6 shrink-0 text-muted" />

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ file.name }}</p>

            <template v-if="getUploadForFile(file, index)">
              <div class="mt-0.5 flex items-center gap-2 text-xs text-muted">
                <span>{{ formatFileSize(file.size) }}</span>

                <template v-if="getUploadForFile(file, index)?.status === 'uploading'">
                  <span>-</span>
                  <span>{{ getUploadForFile(file, index)?.progress.percentage }}%</span>
                  <span>-</span>
                  <span>{{ formatFileSize(getUploadForFile(file, index)?.progress.speed || 0) }}/s</span>
                  <span>-</span>
                  <span>{{ formatDuration(getUploadForFile(file, index)?.progress.remainingTime || 0) }}</span>
                </template>

                <template v-else>
                  <span>-</span>
                  <UBadge :color="getStatusColor(getUploadForFile(file, index)?.status || 'idle')" size="xs" variant="subtle">
                    {{ getStatusLabel(getUploadForFile(file, index)?.status || 'idle') }}
                  </UBadge>
                </template>
              </div>

              <UProgress
                v-if="getUploadForFile(file, index)?.status === 'uploading' || getUploadForFile(file, index)?.status === 'paused'"
                :color="getUploadForFile(file, index)?.status === 'paused' ? 'warning' : 'primary'"
                :value="getUploadForFile(file, index)?.progress.percentage || 0"
                class="mt-2"
                size="xs"
              />
            </template>

            <template v-else>
              <p class="text-xs text-muted">{{ formatFileSize(file.size) }}</p>
            </template>
          </div>

          <!-- Actions -->
          <div class="flex shrink-0 gap-0.5">
            <UButton
              v-if="getUploadForFile(file, index)?.status === 'uploading'"
              color="neutral"
              icon="i-lucide-pause"
              size="xs"
              variant="ghost"
              @click.stop="pauseUpload(getUploadForFile(file, index)!.id)"
            />
            <UButton
              v-if="getUploadForFile(file, index)?.status === 'paused'"
              color="primary"
              icon="i-lucide-play"
              size="xs"
              variant="ghost"
              @click.stop="resumeUpload(getUploadForFile(file, index)!.id)"
            />
            <UButton
              v-if="getUploadForFile(file, index)?.status === 'error'"
              color="warning"
              icon="i-lucide-refresh-cw"
              size="xs"
              variant="ghost"
              @click.stop="retryUpload(getUploadForFile(file, index)!.id)"
            />
            <UButton
              v-if="getUploadForFile(file, index)?.status !== 'completed'"
              color="error"
              icon="i-lucide-x"
              size="xs"
              variant="ghost"
              @click.stop="cancelUpload(getUploadForFile(file, index)!.id)"
            />
          </div>
        </div>
      </template>

      <!-- Actions Slot fuer Bulk-Actions -->
      <template #files-bottom="{ files: fileList }">
        <div v-if="fileList && Array.isArray(fileList) && fileList.length > 1 && uploads.length > 0" class="flex items-center justify-between border-t border-default pt-2">
          <div class="text-xs text-muted">
            <template v-if="isUploading"> {{ totalProgress.percentage }}% - {{ formatFileSize(totalProgress.speed) }}/s </template>
            <template v-else> {{ uploads.filter((u) => u.status === 'completed').length }}/{{ uploads.length }} abgeschlossen </template>
          </div>

          <div class="flex gap-1">
            <UButton v-if="isUploading" color="neutral" size="xs" variant="ghost" @click="pauseAll"> Alle pausieren </UButton>
            <UButton v-if="uploads.some((u) => u.status === 'paused')" color="primary" size="xs" variant="ghost" @click="resumeAll"> Alle fortsetzen </UButton>
            <UButton v-if="uploads.some((u) => u.status === 'completed')" color="neutral" size="xs" variant="ghost" @click="clearCompleted"> Fertige entfernen </UButton>
            <UButton v-if="uploads.length > 0" color="error" size="xs" variant="ghost" @click="cancelAll"> Alle abbrechen </UButton>
          </div>
        </div>
      </template>
    </UFileUpload>
  </div>
</template>
