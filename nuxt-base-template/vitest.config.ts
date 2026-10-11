import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    // Several specs cold-import heavy modules on purpose (`openapi-ts.config` pulls in
    // @hey-api/openapi-ts, config contracts re-import with `vi.resetModules()`). Alone that
    // takes ~1 s; inside the monorepo `check`, where this suite runs in parallel with the
    // API typecheck and the root script tests, it measured past the 5 s default and failed
    // three green tests. Same headroom nest-server-starter gives its unit config.
    testTimeout: 30000,
    include: ['tests/unit/**/*.{test,spec}.ts'],
    globals: true,
    // signal-guard: a test may only signal processes it spawned (see the file header).
    setupFiles: ['tests/unit/setup.ts', 'tests/unit/support/signal-guard.setup.ts'],
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
