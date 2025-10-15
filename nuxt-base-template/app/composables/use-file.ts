interface FileInfo {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  url?: string;
  [key: string]: unknown;
}

export function useFile() {
  const { isValidMongoID } = useHelper();

  async function getFileInfo(id: string | undefined): Promise<FileInfo | string | null> {
    const config = useRuntimeConfig();

    if (!id) {
      return null;
    }

    if (!isValidMongoID(id)) {
      return id;
    }

    try {
      const response = await $fetch<FileInfo>(config.public.host + '/files/info/' + id, {
        method: 'GET'
      });
      return response;
    } catch (error) {
      console.error('Error fetching file info:', error);
      return null;
    }
  }

  return { getFileInfo };
}
