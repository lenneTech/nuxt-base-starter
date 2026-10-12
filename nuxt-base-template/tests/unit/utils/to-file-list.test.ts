/**
 * Guards the value normalisation in app/components/Upload/TusFileUpload.vue.
 *
 * The bug history: Nuxt UI's UFileUpload writes a `File[]` to its v-model only when
 * `multiple` is set. With `:multiple="false"` it writes the single `File`, and `null` once
 * the file is removed. The upload watcher called `.filter()` on that value, threw
 * "newFiles.filter is not a function", and never started the TUS upload — no request, no
 * toast, an empty field. Every single-file upload built on the template was affected.
 */
import { describe, expect, it } from 'vitest';

import { toFileList } from '../../../app/utils/to-file-list';

describe('toFileList', () => {
  const first = new File(['a'], 'a.txt');
  const second = new File(['b'], 'b.txt');

  it('returns an empty list for null (single mode after removing the file)', () => {
    expect(toFileList(null)).toEqual([]);
  });

  it('returns an empty list for undefined (watcher without a previous value)', () => {
    expect(toFileList(undefined)).toEqual([]);
  });

  it('wraps a single File (single mode after picking a file)', () => {
    expect(toFileList(first)).toEqual([first]);
  });

  it('returns a File[] unchanged (multiple mode)', () => {
    const files = [first, second];
    expect(toFileList(files)).toBe(files);
  });
});
