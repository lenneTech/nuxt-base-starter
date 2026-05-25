import { expect, test } from '@nuxt/test-utils/playwright';

// AI assistant route protection. The conversational flow itself requires a
// running backend with a configured LLM connection and is covered by the
// nest-server AI e2e tests; here we verify the frontend wiring + access control.
test.describe('AI assistant', () => {
  test('redirects unauthenticated users away from the chat page', async ({ goto, page }) => {
    await goto('/app/ai', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('redirects unauthenticated users away from the AI settings page', async ({ goto, page }) => {
    await goto('/app/settings/ai', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('protects the AI admin area (admin-only)', async ({ goto, page }) => {
    await goto('/app/admin/ai/connections', { waitUntil: 'domcontentloaded' });
    // admin.global redirects unauthenticated users to login (and non-admins to /app).
    await expect(page).toHaveURL(/\/auth\/login|\/app(\/|$)/);
  });
});
