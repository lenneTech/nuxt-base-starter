import { test } from '@nuxt/test-utils/playwright';

test('init test', async ({ goto }) => {
  await goto('.', { waitUntil: 'domcontentloaded' });
});
