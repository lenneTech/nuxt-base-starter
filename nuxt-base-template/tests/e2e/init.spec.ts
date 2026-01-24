import { test } from '@nuxt/test-utils/playwright';

test('init test', async ({ goto, page }) => {
  await goto('.', { waitUntil: 'domcontentloaded' });
});
