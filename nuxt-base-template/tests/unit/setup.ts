/**
 * Vitest Global Setup
 *
 * This file is loaded before each test file.
 * It sets up global mocks and utilities.
 */

import { vi } from 'vitest';

// This file runs for EVERY test file, including the few that opt into the `node`
// environment via a `@vitest-environment node` docblock (contract tests that make a
// real cross-origin request, which the Same-Origin Policy blocks under happy-dom).
// There is no `window`/`document` there, so the DOM mocks below are guarded — without
// the guard those files fail during setup and vitest reports "no tests", which reads
// like an empty file rather than a broken one.
const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';

// Mock window.location for tests.
//
// `href` deliberately carries a path while `origin` does not. When both held the same
// bare origin, code that should read `origin` could read `href` instead and no test
// could tell the difference — a real defect (a redirect target built from `href`
// becomes `…/auth/forgot-password/auth/reset-password`) would have looked green.
// Keep them distinguishable.
if (hasDom) {
  Object.defineProperty(window, 'location', {
    value: {
      hostname: 'localhost',
      href: 'http://localhost:3001/auth/forgot-password',
      origin: 'http://localhost:3001',
      pathname: '/auth/forgot-password',
      search: '',
      hash: '',
    },
    writable: true,
  });
}

// Mock document.cookie
let cookies: Record<string, string> = {};

if (hasDom) {
  Object.defineProperty(document, 'cookie', {
    get: () => {
      return Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
    },
    set: (value: string) => {
      const [cookiePart = ''] = value.split(';');
      const [key = '', val] = cookiePart.split('=');
      if (val === '' || value.includes('max-age=0')) {
        delete cookies[key];
      } else {
        cookies[key] = val ?? '';
      }
    },
  });
}

// Helper to reset cookies between tests
export function resetCookies(): void {
  cookies = {};
}

// Keep a handle on the real fetch BEFORE mocking it. Contract tests that
// deliberately reach the network (see `playwright-image-contract.test.ts`) need it —
// without this they silently receive `undefined` from the mock, and a test that
// treats that as "network unavailable" passes while checking nothing.
globalThis.__realFetch = globalThis.fetch;

// Mock fetch globally
globalThis.fetch = vi.fn();

// Mock console methods to avoid noise in tests
vi.spyOn(console, 'debug').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});

// Export for use in tests
export { vi };

declare global {
  // eslint-disable-next-line no-var
  var __realFetch: typeof fetch;
}
