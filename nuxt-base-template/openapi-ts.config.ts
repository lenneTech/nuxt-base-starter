import { defineConfig } from '@hey-api/openapi-ts';

import { withOpenApiPath } from './scripts/resolve-api-url.mjs';

/**
 * `NUXT_API_URL` is resolved and validated by `scripts/generate-types.mjs`,
 * which `pnpm run generate-types` invokes — it loads `<root>/.lt-dev/.env`
 * under `lt dev up` and refuses a URL that belongs to another project.
 *
 * This file keeps a hard guard for the case someone runs `openapi-ts` directly:
 * there is deliberately NO default URL. The previous fallback to a fixed
 * localhost port silently generated `types.gen.ts` / `sdk.gen.ts` from whichever
 * project happened to hold that port, reported success and exited 0 (DEV-2802).
 *
 * `withOpenApiPath` appends the OpenAPI path when missing: `lt dev up` exports
 * `NUXT_API_URL` as the API BASE url, and handing that to the generator verbatim
 * makes it fetch the API root and fail with `"…" is not a valid JSON Schema`.
 */
const apiUrl = (process.env.NUXT_API_URL || '').trim();

if (!apiUrl) {
  throw new Error(
    [
      'NUXT_API_URL is not set.',
      '',
      'Use `pnpm run generate-types` — it resolves the URL from `lt dev` and',
      "validates that it really is THIS project's API. To call openapi-ts",
      'directly, set the variable yourself:',
      '',
      '    NUXT_API_URL=<api-base-url> pnpm exec openapi-ts',
      '',
      'There is deliberately no default (DEV-2802).',
    ].join('\n'),
  );
}

export default defineConfig({
  input: withOpenApiPath(apiUrl),
  output: {
    path: './app/api-client',
    postProcess: ['oxlint', 'oxfmt'],
  },
  plugins: ['@hey-api/client-fetch', '@hey-api/sdk', '@hey-api/typescript', '@hey-api/transformers'],
});
