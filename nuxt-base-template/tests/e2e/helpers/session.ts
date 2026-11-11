import type { Page } from '@playwright/test';

/**
 * End the browser's session for good, so the next sign-in starts signed out.
 *
 * `clearCookies()` alone raced with the page still open on /app: a request of it that was in flight
 * (the session check, the AI status) came back after the clear with `Set-Cookie` and signed the user
 * in again. `/auth/login` then sent them on to /app, and the login form never showed (measured
 * 2026-11-11: 4 of 12 runs of the admin specs, in CI flaky since better-auth 1.7.18 refreshes the
 * session cookie on those requests). Leaving the app first means no response of it arrives later.
 */
export async function dropSession(page: Page): Promise<void> {
  await page.goto('about:blank');
  await page.context().clearCookies();
}
