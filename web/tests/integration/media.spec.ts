import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('real API uploads, Markdown, covers, presets, and cross-origin images work together', async ({ page, request, browser }, testInfo) => {
  const failures: string[] = []
  page.on('pageerror', error => failures.push(error.message))
  await page.goto('/login')
  await page.getByLabel('Username', { exact: true }).fill('smoke-admin')
  await page.getByLabel('Password', { exact: true }).fill('smoke-test-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('http://127.0.0.1:5189/')
  const token = await page.evaluate(() => localStorage.getItem('teamorbit-token'))
  const png = await readFile(new URL('../../../api/src/assets/avatars/default-raven.png', import.meta.url))
  const uploaded = await request.post('/api/uploads', { headers: { Authorization: `Bearer ${token}` }, multipart: { file: { name: 'portrait.png', mimeType: 'image/png', buffer: png } } })
  expect(uploaded.status()).toBe(201)
  const { url } = await uploaded.json()
  expect(url).toMatch(/^http:\/\/127\.0\.0\.1:3099\/uploads\//)
  const content = `# Real media\n\n![Uploaded illustration](${url})\n\n| Model | Ready |\n| --- | --- |\n| Bird | Yes |\n\nInline math: $E = mc^2$.`
  const published = await request.post('/api/blog-posts', { headers: { Authorization: `Bearer ${token}` }, data: { title: 'Real image smoke test', content, coverImageUrl: url, tags: ['smoke'] } })
  expect(published.status()).toBe(201)
  await page.goto('/blog')
  await page.getByText('Real image smoke test', { exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('table')).toContainText('Bird')
  await expect(dialog.locator('.katex')).toHaveCount(1)
  const image = dialog.getByRole('img', { name: 'Uploaded illustration' })
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await expect.poll(() => dialog.locator('img').first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await page.screenshot({ path: testInfo.outputPath('blog-preview.png'), fullPage: true, animations: 'disabled' })
  // A separate browser context has no app token and accesses the media directly.
  const external = await browser.newContext()
  try {
    const other = await external.newPage()
    await other.goto(url)
    expect((await external.request.get(url)).headers()['content-type']).toContain('image/png')
  } finally { await external.close() }
  const presets = await request.get('/api/avatars')
  const { items } = await presets.json()
  for (const preset of items) expect((await request.get(preset.url)).status()).toBe(200)
  await page.keyboard.press('Escape')
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Select Frazzled Owl avatar' }).click()
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect(page.getByText('Profile updated', { exact: true })).toBeVisible()
  expect(failures).toEqual([])
})
