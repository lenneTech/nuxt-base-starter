import { createClient, createConfig } from '@hey-api/client-fetch';

/**
 * Configures the hey-api SDK client with the correct baseURL for
 * the current execution context:
 *   - Server (SSR): NUXT_API_URL → direct backend URL (no proxy hop)
 *   - Client (browser) + apiProxy=true: '' → same-origin Vite /api proxy
 *     (NUXT_PUBLIC_API_PROXY=true in .env). Same-origin means cookies are
 *     sent automatically — no credentials config needed.
 *   - Client (browser) + apiProxy=false: NUXT_PUBLIC_API_URL → direct
 *     cross-origin call; credentials:'include' ensures session cookies
 *     are attached even across origins.
 */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  // Use the same-origin Vite proxy when NUXT_PUBLIC_API_PROXY=true (local dev)
  const useProxy = !import.meta.server && !!config.public.apiProxy;
  createClient(
    createConfig({
      baseUrl: import.meta.server
        ? (config.apiUrl as string)
        : useProxy
          ? ''
          : (config.public.apiUrl as string),
      // Include cookies on cross-origin requests so session tokens are sent
      // when the browser calls the backend directly (proxy disabled).
      credentials: 'include',
    }),
  );
});
