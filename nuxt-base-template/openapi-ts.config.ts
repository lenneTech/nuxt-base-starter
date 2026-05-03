import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: process.env.NUXT_API_URL || 'http://127.0.0.1:3000/api/openapi.json',
  output: {
    path: './app/api-client',
    postProcess: ['oxlint', 'oxfmt'],
  },
  plugins: ['@hey-api/client-fetch', '@hey-api/sdk', '@hey-api/typescript', '@hey-api/transformers'],
});
