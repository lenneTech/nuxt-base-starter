/**
 * Mounts the real app/components/Upload/TusFileUpload.vue and drives its UFileUpload v-model.
 *
 * WHY A MOUNT AND NOT ONLY THE HELPER SPEC
 *
 * `tests/unit/utils/to-file-list.test.ts` pins the normalisation, but not that the component
 * uses it. Restoring the old watcher (`newFiles.filter(...)` on the raw model value) kept every
 * gate green, while every single-file upload on the template did nothing again: Nuxt UI writes
 * a single `File` (and `null` after removal) when `multiple` is false, the watcher threw
 * "newFiles.filter is not a function", and no request and no toast followed.
 *
 * HOW
 *
 * There is no Nuxt environment in this suite, so the auto-imports the SFC relies on are
 * provided as globals, `useLtTusUpload` is replaced by a spy, and UFileUpload by a stub that
 * emits `update:modelValue` exactly as Nuxt UI 4.11.3 does (`FileUpload.vue`, `onUpdate`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, createApp, defineComponent, h, nextTick, ref, watch } from 'vue';

import TusFileUpload from '../../../app/components/Upload/TusFileUpload.vue';
import { toFileList } from '../../../app/utils/to-file-list';

type ModelValue = File | File[] | null;

function mountTusFileUpload(props: Record<string, unknown>) {
  const addFiles = vi.fn();
  const errors: unknown[] = [];
  const emitted: File[][] = [];
  let pick: (value: ModelValue) => void = () => {};

  vi.stubGlobal('ref', ref);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('watch', watch);
  vi.stubGlobal('toFileList', toFileList);
  vi.stubGlobal('useToast', () => ({ add: vi.fn() }));
  vi.stubGlobal('useLtFile', () => ({ formatDuration: String, formatFileSize: String }));
  vi.stubGlobal('useLtTusUpload', () => ({
    addFiles,
    cancelAll: vi.fn(),
    cancelUpload: vi.fn(),
    clearCompleted: vi.fn(),
    isUploading: ref(false),
    pauseAll: vi.fn(),
    pauseUpload: vi.fn(),
    resumeAll: vi.fn(),
    resumeUpload: vi.fn(),
    retryUpload: vi.fn(),
    totalProgress: ref({ percentage: 0, speed: 0 }),
    uploads: ref([]),
  }));

  const UFileUpload = defineComponent({
    emits: ['update:modelValue'],
    props: { modelValue: { default: null, type: null } },
    setup(_, { emit }) {
      pick = (value) => emit('update:modelValue', value);
      return () => h('div');
    },
  });

  const app = createApp(TusFileUpload, { ...props, 'onUpdate:modelValue': (files: File[]) => emitted.push(files) });
  app.component('UFileUpload', UFileUpload);
  // Rendered only inside the file slot, which the stub never renders — registered so Vue does
  // not warn about components it cannot resolve.
  for (const name of ['UBadge', 'UButton', 'UIcon', 'UProgress']) {
    app.component(name, defineComponent({ render: () => null }));
  }
  app.config.errorHandler = (error) => errors.push(error);
  app.mount(document.createElement('div'));

  return { addFiles, emitted, errors, pick: (value: ModelValue) => pick(value) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TusFileUpload', () => {
  it('queues a single picked file when multiple is false', async () => {
    const { addFiles, emitted, errors, pick } = mountTusFileUpload({ multiple: false });
    const file = new File(['a'], 'a.txt');

    pick(file);
    await nextTick();

    expect(errors).toEqual([]);
    expect(addFiles).toHaveBeenCalledWith([file]);
    expect(emitted.at(-1)).toEqual([file]);
  });

  it('emits an empty list and queues nothing when the single file is removed', async () => {
    const { addFiles, emitted, errors, pick } = mountTusFileUpload({ multiple: false });

    pick(new File(['a'], 'a.txt'));
    await nextTick();
    pick(null);
    await nextTick();

    expect(errors).toEqual([]);
    expect(emitted.at(-1)).toEqual([]);
    expect(addFiles).toHaveBeenCalledTimes(1);
  });

  it('queues only the newly added files when multiple is true', async () => {
    const { addFiles, errors, pick } = mountTusFileUpload({ multiple: true });
    const first = new File(['a'], 'a.txt');
    const second = new File(['b'], 'b.txt');

    pick([first]);
    await nextTick();
    pick([first, second]);
    await nextTick();

    expect(errors).toEqual([]);
    expect(addFiles.mock.calls).toEqual([[[first]], [[second]]]);
  });
});
