// Nuxt UI's UFileUpload writes a `File[]` to its v-model only with `multiple`. In single
// mode it writes the `File` itself, and `null` once the file is removed. Code that reads
// that model as an array (`.filter`, `.includes`) throws on every single-file upload.
export function toFileList(value: File | File[] | null | undefined): File[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
}
