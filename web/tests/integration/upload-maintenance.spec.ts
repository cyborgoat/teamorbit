import { test, expect } from '@playwright/test'

test('real uploads are reconciled in the admin page and shared images are retained', async ({
  page,
  request,
}, testInfo) => {
  await page.goto('/login')
  await page.getByLabel('Username', { exact: true }).fill('smoke-admin')
  await page.getByLabel('Password', { exact: true }).fill('smoke-test-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('http://127.0.0.1:5189/')
  const token = await page.evaluate(() =>
    localStorage.getItem('teamorbit-token'),
  )
  const headers = { Authorization: `Bearer ${token}` }
  const upload = async () => {
    const response = await request.post('/api/uploads', {
      headers,
      multipart: {
        file: {
          name: 'cleanup.svg',
          mimeType: 'image/svg+xml',
          buffer: Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>',
          ),
        },
      },
    })
    expect(response.status()).toBe(201)
    return (await response.json()) as { filename: string; url: string }
  }
  const orphan = await upload()
  const shared = await upload()
  expect(
    (
      await request.post('/api/news', {
        headers,
        data: {
          title: 'Retained cleanup image',
          content: `![retained](${shared.url})`,
        },
      })
    ).status(),
  ).toBe(201)
  await page
    .getByRole('link', { name: 'Upload maintenance', exact: true })
    .click()
  await expect(page.getByText(orphan.filename, { exact: true })).toBeVisible()
  await expect(page.getByText(shared.filename, { exact: true })).toHaveCount(0)
  await expect(page.getByText('Grace period', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Clean now', exact: true }),
  ).toBeDisabled()
  const started = await request.post('/api/uploads/cleanup', { headers })
  expect(started.status()).toBe(202)
  await expect
    .poll(async () => {
      const response = await request.get('/api/uploads/cleanup', { headers })
      return (await response.json()).lastRun.status
    })
    .toBe('COMPLETED')
  await page
    .getByRole('button', { name: 'Refresh preview', exact: true })
    .click()
  await expect(page.getByText(/Status: COMPLETED/)).toBeVisible()
  expect((await request.get(orphan.url)).status()).toBe(200)
  expect((await request.get(shared.url)).status()).toBe(200)
  await page.screenshot({
    path: testInfo.outputPath('upload-maintenance.png'),
    fullPage: true,
  })
})
