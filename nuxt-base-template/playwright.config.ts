import type { ConfigOptions } from '@nuxt/test-utils/playwright';

import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { isCI, isWindows } from 'std-env';

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

/* See https://playwright.dev/docs/test-configuration. */
export default defineConfig<ConfigOptions>({
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!isCI,
  /* Run tests in files in parallel */
  fullyParallel: true,
  projects: devicesToTest.map((p) => (typeof p === 'string' ? { name: p, use: devices[p] } : p)),
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Retry on CI only */
  retries: isCI ? 2 : 0,
  testDir: './tests/e2e',
  timeout: isWindows ? 60000 : undefined,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: 'http://localhost:3001',

    launchOptions: {
      // Slows down Playwright operations by the specified amount of milliseconds
      slowMo: 10,
    },

    // Use German language
    locale: 'de',
    /* Nuxt configuration options */
    nuxt: {
      host: 'http://localhost:3001',
      rootDir: fileURLToPath(new URL('.', import.meta.url)),
    },
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run start',
      reuseExistingServer: !process.env.CI,
      stderr: 'pipe',
      stdout: 'pipe',
      timeout: 120 * 1000,
      url: 'http://localhost:3001',
    },
  ],
  /* Opt out of parallel tests on CI. */
  workers: isCI ? 1 : undefined,
});
