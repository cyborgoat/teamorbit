import { expect, test } from '@playwright/test'
import { mockSocket } from './mock-socket'

test.beforeEach(async ({ page }) => {
  const admin = {
    id: 'admin',
    username: 'admin',
    fullName: 'Test Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
  }
  await page.addInitScript(() => {
    localStorage.setItem('teamorbit-token', 'test-token')
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          document.body.dataset.testClipboard = text
        },
      },
    })
  })
  await mockSocket(page)
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    await route.fulfill({
      json: path === '/api/auth/me' ? admin : { items: [], total: 0 },
    })
  })
  await page.route('**/api/users/batch', async (route) => {
    await route.fulfill({
      status: 201,
      json: {
        created: [
          { user: { username: 'alex' }, password: 'generated-password' },
        ],
        skipped: [{ row: 2, username: 'admin', field: 'email' }],
      },
    })
  })

  await page.goto('/users')
  await page.getByRole('button', { name: 'Batch create', exact: true }).click()
})

test('pastes or uploads CSV and shows copyable credentials once', async ({
  page,
}) => {
  const input = page.getByLabel('Paste or edit CSV')
  const submit = page.getByRole('button', { name: 'Create users', exact: true })
  const rows = Array.from(
    { length: 51 },
    (_, index) => `member${index},Member ${index}`,
  )
  await input.fill(rows.slice(0, 50).join('\n'))
  await expect(submit).toBeEnabled()
  await input.fill(rows.join('\n'))
  await expect(page.getByText('Use at most 50 rows per batch.')).toBeVisible()
  await expect(submit).toBeDisabled()

  await input.fill('alex,,invalid')
  await expect(
    page.getByText('Full name is required', { exact: false }),
  ).toBeVisible()
  await expect(submit).toBeDisabled()

  await input.fill('alex,"Unclosed name')
  await expect(page.getByRole('alert')).toContainText('CSV row 1')
  await expect(submit).toBeDisabled()

  await input.fill('alex,Alex Rivera')
  await expect(
    page.getByRole('table', { name: 'Batch preview' }),
  ).toContainText('Alex Rivera')
  await page.getByLabel('Upload CSV').setInputFiles({
    name: 'accounts.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      '\uFEFFusername,fullName,email\r\nalex,"Rivera, Alex"\r\n\r\nadmin,Test Admin,admin@example.com',
    ),
  })
  await expect(
    page.getByRole('table', { name: 'Batch preview' }),
  ).toContainText('Rivera, Alex')
  const batchRequest = page.waitForRequest('**/api/users/batch')
  await submit.click()
  expect((await batchRequest).postDataJSON()).toEqual({
    users: [
      { username: 'alex', fullName: 'Rivera, Alex' },
      { username: 'admin', fullName: 'Test Admin', email: 'admin@example.com' },
    ],
  })
  await expect(page.getByText('Row 4 (admin)', { exact: false })).toBeVisible()
  const credentials = page.getByLabel('Usernames and passwords')
  await expect(credentials).toHaveValue('alex,generated-password')
  await page.getByRole('button', { name: 'Copy credentials' }).click()
  await expect(page.locator('body')).toHaveAttribute(
    'data-test-clipboard',
    'alex,generated-password',
  )
  await page.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('button', { name: 'Batch create', exact: true }).click()
  await expect(input).toHaveValue('')
  await expect(credentials).toHaveCount(0)
})

test('adds and removes account rows in the manual form', async ({ page }) => {
  await page.getByRole('tab', { name: 'Manual entry' }).click()
  const account = (number: number) =>
    page.getByRole('group', { name: `Account ${number}`, exact: true })
  const addAccount = page.getByRole('button', { name: 'Add account' })
  await account(1).getByLabel('Username').fill('alex')
  await account(1).getByLabel('Full name').fill('Alex Rivera')
  await addAccount.click()
  const submit = page.getByRole('button', { name: 'Create users', exact: true })
  await expect(submit).toBeDisabled()
  await account(2).getByLabel('Username').fill('admin')
  await account(2).getByLabel('Full name').fill('Test Admin')
  await account(2).getByLabel('Email (optional)').fill('admin@example.com')
  await addAccount.click()
  await page.getByRole('button', { name: 'Remove account 3' }).click()
  await page.getByRole('tab', { name: 'CSV', exact: true }).click()
  await page.getByRole('tab', { name: 'Manual entry' }).click()
  await expect(account(1).getByLabel('Username')).toHaveValue('alex')
  const batchRequest = page.waitForRequest('**/api/users/batch')
  await submit.click()
  expect((await batchRequest).postDataJSON()).toEqual({
    users: [
      { username: 'alex', fullName: 'Alex Rivera' },
      { username: 'admin', fullName: 'Test Admin', email: 'admin@example.com' },
    ],
  })
  await expect(page.getByText('Row 2 (admin)', { exact: false })).toBeVisible()
})
