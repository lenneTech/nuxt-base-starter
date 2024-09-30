import { expect, test } from '@nuxt/test-utils/playwright'

test('init test', async ({ page, goto }) => {
  await goto('https://lenne.tech', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Wir unterstützen Dich!' })).toHaveText('Wir unterstützen Dich!')
})