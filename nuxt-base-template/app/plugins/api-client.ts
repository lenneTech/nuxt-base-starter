import { createClient, createConfig } from '@hey-api/client-fetch';

/**
 * Configures the hey-api SDK client with the correct baseURL for
 * the current execution context:
 *   - Server (SSR): NUXT_API_URL → direct backend URL (no proxy hop)
 *   - Client (browser): '' → requests go to the Vite dev proxy at /api
 *
 * Called once on app startup (Nuxt plugin runs on both server and client).
 */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  createClient(
    createConfig({
      baseUrl: import.meta.server
        ? (config.apiUrl as string)
        : (config.public.apiUrl as string),
    }),
  );
});
