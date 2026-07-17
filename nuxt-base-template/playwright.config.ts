import type { ConfigOptions } from '@nuxt/test-utils/playwright';

import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Node-native equivalents (avoid an undeclared `std-env` dependency that a fresh
// project's strict node_modules cannot resolve → ERR_MODULE_NOT_FOUND at load).
const isCI = !!process.env.CI;
const isWindows = process.platform === 'win32';

const devicesToTest = [
  'Desktop Chrome',
  // Test against other common browser engines.
  // 'Desktop Firefox',
  // 'Desktop Safari',
  // Test against mobile viewports.
  // 'Pixel 5',
  // 'iPhone 12',
  // Test against branded browsers.
  // { ...devices['Desktop Edge'], channel: 'msedge' },
  // { ...devices['Desktop Chrome'], channel: 'chrome' },
] satisfies Array<(typeof devices)[string] | string>;

// `lt dev test --shard N` runs N built stacks + N Chromium concurrently, which
// saturates the CPU and slows SSR navigation 2-3x. The CLI exports
// `LT_DEV_TEST_SHARDS` so we relax timeouts ONLY under that load — serial + CI
// keep their tight defaults (fast-failure feedback unchanged). For per-call
// `waitForURL` overrides, gate them on this too, e.g.:
//   const NAV = Number(process.env.LT_DEV_TEST_SHARDS || '0') > 1 ? 60_000 : 15_000;
const SHARDED = Number(process.env.LT_DEV_TEST_SHARDS || '0') > 1;

/* See https://playwright.dev/docs/test-configuration. */
export default defineConfig<ConfigOptions>({
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!isCI,
  /* Hard ceiling for the WHOLE run (per-test timeouts don't cover hangs outside
     tests: webServer reuse checks, reporters, teardown). Prevents a wedged run
     from spinning forever — the Playwright equivalent of the check.mjs watchdog. */
  globalTimeout: 60 * 60 * 1000,
  /* Run tests in files in parallel */
  fullyParallel: true,
  projects: devicesToTest.map((p) => (typeof p === 'string' ? { name: p, use: devices[p] } : p)),
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Retry on CI only */
  retries: isCI ? 2 : 0,
  testDir: './tests/e2e',
  timeout: isWindows ? 60000 : SHARDED ? 180_000 : undefined,
  /* Assertion timeout: Playwright default in serial/CI; relaxed under sharded load. */
  expect: { timeout: SHARDED ? 30_000 : undefined },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3001',

    // Accept the `lt dev` Caddy self-signed cert on `https://*.localhost` (Node
    // trusts it via NODE_EXTRA_CA_CERTS, but Playwright's bundled Chromium uses
    // its own trust store). No-op in CI (plain http://localhost).
    ignoreHTTPSErrors: true,

    // Navigation/action ceilings ONLY under sharded load (serial/CI = defaults).
    actionTimeout: SHARDED ? 30_000 : undefined,
    navigationTimeout: SHARDED ? 60_000 : undefined,

    launchOptions: {
      // No artificial slow-down — it only adds latency (×N under sharding).
      slowMo: 0,
    },

    // Use German language
    locale: 'de',
    /* Capture a screenshot on failure — aids CI failure diagnosis. */
    screenshot: 'only-on-failure',
    /* Nuxt configuration options */
    nuxt: {
      host: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3001',
      rootDir: fileURLToPath(new URL('.', import.meta.url)),
    },
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  // Under `lt dev` / `lt dev test` the App is already served behind Caddy
  // (the CLI exports `LT_DEV_ACTIVE` into the test env and sets
  // `NUXT_PUBLIC_SITE_URL` to the running App URL). In that case Playwright must
  // NOT start or manage its own server — it just targets the provided baseURL.
  // This keeps `lt dev test` (isolated stack) from ever spawning a stray
  // `npm run start` on the wrong port when the reuse check is flaky.
  webServer: process.env.LT_DEV_ACTIVE
    ? undefined
    : [
        {
          command: 'npm run start',
          // Fail fast instead of silently testing a FOREIGN server: on a
          // multi-project machine, `reuseExistingServer: true` makes a classic
          // (non-`lt dev`) run reuse whatever is already bound to :3001 — which
          // can be ANOTHER checkout's app, so the suite tests the wrong code.
          // With `false`, Playwright errors clearly when the port is taken.
          // The isolated `lt dev test` path (own port, own DB) is unaffected —
          // it never uses this webServer block (see LT_DEV_ACTIVE above).
          reuseExistingServer: false,
          stderr: 'pipe',
          stdout: 'pipe',
          // Cold CI runners need longer than a warm local machine to build +
          // boot the Nuxt app before the readiness probe passes.
          timeout: (isCI ? 300 : 120) * 1000,
          url: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3001',
        },
      ],
  /* Use single worker to prevent WebAuthn virtual authenticator conflicts across test files */
  workers: 1,
});
