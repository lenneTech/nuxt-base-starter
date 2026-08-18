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
// `LT_DEV_TEST_SHARDS` so we relax timeouts under that load; a warm local serial
// run keeps the tight defaults (fast-failure feedback unchanged). For per-call
// `waitForURL` overrides, gate them on `RELAXED` below rather than on this flag
// alone, e.g.:
//   const NAV = RELAXED ? 60_000 : 15_000;
const SHARDED = Number(process.env.LT_DEV_TEST_SHARDS || '0') > 1;

// CI needs the same relief, for a different reason. The webServer below starts
// `nuxt dev` — a DEV server with no Vite cache on a fresh runner — so the first
// navigation to each route pays an on-demand SSR compile INSIDE the budget of
// whichever test happens to visit it first. Against Playwright's 30s default
// that is a coin flip, and it shows: the failing spec moves between runs
// (`page.waitForFunction`/`locator.click` timeouts on a different file each
// time), while the same specs pass locally against a warm server. "Tight
// defaults = fast failure" only holds when the clock measures the assertion;
// here it measures the compiler, so it produces retries and false alarms
// instead of feedback.
//
// The surgical alternative is to warm the routes before the suite (compile
// once, then test); relaxing the ceilings reuses the mechanism this config
// already has for the analogous sharded case and keeps `retries` + the
// `globalTimeout` backstop as the guard against a genuinely wedged run.
//
// NOT relaxed when the BUILT server is used (`E2E_BUILT_SERVER=true`, which CI
// now sets): that removes the on-demand SSR compile which is the entire reason
// above. Keeping the relief anyway would only mean a genuinely hung test burns
// 180s × (1 + 2 retries) = 9 minutes instead of failing in 90 seconds.
const BUILT_SERVER = process.env.E2E_BUILT_SERVER === 'true';
const RELAXED = SHARDED || (isCI && !BUILT_SERVER);

/* See https://playwright.dev/docs/test-configuration. */
export default defineConfig<ConfigOptions>({
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!isCI,
  /* Hard ceiling for the WHOLE run (per-test timeouts don't cover hangs outside
     tests: webServer reuse checks, reporters, teardown). Prevents a wedged run
     from spinning forever — the Playwright equivalent of the check.mjs watchdog.

     Deliberately BELOW the CI job timeout (1 hour in .gitlab-ci.yml). It used to
     be exactly 60 minutes, which meant it could never fire: Playwright's clock
     starts only after install, artifact download, Mongo, migrations and API boot,
     so the runner always killed the job first — and a killed job writes no
     report. That is precisely the "ran to the hour limit without ever printing a
     summary" symptom. Keep this comfortably under whatever the job allows. */
  globalTimeout: 40 * 60 * 1000,
  /* Stop the run after this many failures on CI. `globalTimeout` above is the
     ceiling for a WEDGED run; this is the ceiling for a BROKEN environment, and
     they fail differently. When the database or the API is gone, every test still
     "runs": each one burns its 30s timeout, times that by `retries: 2` below —
     ~95s apiece — and the shard spends its whole budget proving the same fault
     over and over. Five is enough evidence.

     Note this covers what the mongo watchdog in CI cannot see: the watchdog polls
     one socket, so a dead API, a wedged mongod that still accepts TCP, or a
     service flapping below its miss threshold all slip past it and land here
     instead.

     The trade-off, deliberately taken: on a genuinely broken merge request you no
     longer see every failure in one report. With ~12 tests per shard, a run past
     five failures is not a list of bugs to work through — it is one cause, and
     the first five instances point at it just as well. Off locally (0), where
     seeing the full picture costs nothing. */
  maxFailures: isCI ? 5 : 0,
  /* Run tests in files in parallel */
  fullyParallel: true,
  projects: devicesToTest.map((p) => (typeof p === 'string' ? { name: p, use: devices[p] } : p)),
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Retry on CI only */
  retries: isCI ? 2 : 0,
  testDir: './tests/e2e',
  timeout: isWindows ? 60000 : RELAXED ? 180_000 : undefined,
  /* Assertion timeout: Playwright default for a warm serial run; relaxed under
     sharded load and on CI's cold dev server (see RELAXED). */
  expect: { timeout: RELAXED ? 30_000 : undefined },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3001',

    // Accept the `lt dev` Caddy self-signed cert on `https://*.localhost` (Node
    // trusts it via NODE_EXTRA_CA_CERTS, but Playwright's bundled Chromium uses
    // its own trust store). No-op in CI (plain http://localhost).
    ignoreHTTPSErrors: true,

    // Navigation/action ceilings under sharded load AND on CI (cold dev server);
    // a warm local serial run keeps Playwright's defaults.
    actionTimeout: RELAXED ? 30_000 : undefined,
    navigationTimeout: RELAXED ? 60_000 : undefined,

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
          /**
           * The BUILT server when `E2E_BUILT_SERVER=true`, `nuxt dev` otherwise.
           *
           * `nuxt dev` recompiles every route on first visit — once per device
           * project. On CI that Vite cold start dominates the runtime badly enough
           * that the suite can hit the job time limit without ever printing a
           * summary. The built server boots once and serves finished bundles;
           * `lt-monorepo/.gitlab-ci.yml` (job `app:test`) passes it to every shard
           * as the `build` job's artifact. This repo's own GitHub workflow has no
           * e2e job, so the flag is unset here and `nuxt dev` is what runs.
           *
           * Locally `nuxt dev` stays the default so HMR is preserved.
           *
           * The output path follows `NITRO_OUTPUT_DIR` for the same reason
           * `nuxt.config.ts` exposes it — hardcoding `.output` would break the
           * moment someone builds into a different tree.
           */
          command: process.env.E2E_BUILT_SERVER === 'true' ? `node ${process.env.NITRO_OUTPUT_DIR || '.output'}/server/index.mjs` : 'npm run start',
          /**
           * Set the port explicitly — the built server does not guess it.
           *
           * `nuxt dev` knows the project port from the Nuxt config; the built Nitro
           * server does not. It reads `PORT` or falls back to 3000 — on CI exactly
           * the API's port. It would then die immediately with `EADDRINUSE` while
           * Playwright keeps waiting on :3001. Deriving the port from the expected
           * URL keeps it to one source with no second value that can drift.
           *
           * A URL with no explicit port (`https://app.localhost`, what `lt dev up`
           * exports) yields `''` and falls back to 3001. That combination is
           * unreachable here: `lt dev` also sets `LT_DEV_ACTIVE`, which skips this
           * whole `webServer` block.
           */
          env: { PORT: new URL(process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3001').port || '3001' },
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
