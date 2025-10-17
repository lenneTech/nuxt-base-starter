import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  client: '@hey-api/client-fetch',
  input: process.env.API_URL || 'http://127.0.0.1:3000/api-docs-json',
  output: {
    format: 'prettier',
    lint: 'eslint',
    path: './app/api-client',
  },
  plugins: [
    '@hey-api/sdk',
    {
      dates: true,
      name: '@hey-api/typescript',
    },
  ],
});
