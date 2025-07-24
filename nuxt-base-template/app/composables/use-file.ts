import { useFetch } from '@vueuse/core';

export function useFile() {
  const { isValidMongoID } = useHelper();
  async function getFileInfo(id: string | undefined): Promise<any> {
    const config = useRuntimeConfig();

    if (!id) {
      return null;
    }

    if (!isValidMongoID(id)) {
      return id;
    }

    return useFetch<File>(config.public.apiUrl + '/files/info/' + id, { method: 'GET' });
  }

  return { getFileInfo };
}
