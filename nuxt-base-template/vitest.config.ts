import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.{test,spec}.ts'],
    globals: true,
    setupFiles: ['tests/unit/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // `scripts/**` is build tooling, but `generate-types.mjs` carries the
      // DEV-2802 fail-closed contract, so it belongs in the coverage picture.
      include: ['app/**/*.{ts,vue}', 'scripts/**/*.mjs'],
      exclude: ['app/**/*.d.ts', 'app/**/*.spec.ts', 'app/**/*.test.ts'],
    },
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '#imports': fileURLToPath(new URL('./tests/unit/mocks/nuxt-imports.ts', import.meta.url)),
    },
  },
});
