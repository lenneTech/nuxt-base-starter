interface FileInfo {
  [key: string]: unknown;
  filename: string;
  id: string;
  mimetype: string;
  size: number;
  url?: string;
}

export function useFile() {
  const config = useRuntimeConfig();

  function isValidMongoID(id: string): boolean {
    return /^[a-f\d]{24}$/i.test(id);
  }

  async function getFileInfo(id: string | undefined): Promise<FileInfo | null | string> {
    if (!id) {
      return null;
    }

    if (!isValidMongoID(id)) {
      return id;
    }

    try {
      const response = await $fetch<FileInfo>(config.public.host + '/files/info/' + id, {
        credentials: 'include',
        method: 'GET',
      });
      return response;
    } catch (error) {
      console.error('Error fetching file info:', error);
      return null;
    }
  }

  function getFileUrl(id: string): string {
    return `${config.public.host}/files/${id}`;
  }

  function getDownloadUrl(id: string, filename?: string): string {
    const base = `${config.public.host}/files/download/${id}`;
    return filename ? `${base}?filename=${encodeURIComponent(filename)}` : base;
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  return {
    formatDuration,
    formatFileSize,
    getDownloadUrl,
    getFileInfo,
    getFileUrl,
    isValidMongoID,
  };
}
