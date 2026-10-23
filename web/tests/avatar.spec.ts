import { mockSocket } from './mock-socket'
import { readFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'
import { avatarPresets } from '../../api/src/avatars/presets'

const defaultAvatar = 'http://localhost:3000/avatars/default-raven.png'
const catalogue = avatarPresets.map(({ path, ...preset }) => ({
  ...preset,
  url: `http://localhost:3000${path}`,
}))
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZQAAAABJRU5ErkJggg==',
  'base64',
)

async function mockAvatars(
  page: Page,
  role = 'USER',
  avatarUrl: string | null = null,
) {
  const profile = {
    id: 'member',
    username: 'member',
    fullName: 'Team Member',
    email: null,
    role,
    status: 'ACTIVE',
    avatarUrl,
  }
  const members = [
    profile,
    {
      ...profile,
      id: 'other',
      username: 'other',
      fullName: 'Other Member',
      role: 'USER',
    },
    {
      ...profile,
      id: 'super',
      username: 'super',
      fullName: 'Super Admin',
      role: 'SUPERUSER',
    },
  ]
  const state = {
    profile,
    members,
    updates: [] as { avatarUrl: string | null }[],
    failUpload: false,
    failPresets: false,
    uploads: 0,
  }
  await page.addInitScript(() =>
    localStorage.setItem('teamorbit-token', 'test-token'),
  )
  await mockSocket(page)
  await page.route('**/*', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace(/^\/api(?=\/)/, '')
    const portrait = avatarPresets.find((preset) => preset.path === path)
    if (portrait)
      return route.fulfill({
        contentType: 'image/png',
        body: await readFile(
          new URL(`../../api/src/assets${portrait.path}`, import.meta.url),
        ),
      })
    if (path === '/avatars')
      return state.failPresets
        ? route.fulfill({
            status: 500,
            json: { message: 'Catalogue unavailable' },
          })
        : route.fulfill({ json: { items: catalogue } })
    if (
      request.resourceType() === 'image' &&
      new URL(request.url()).hostname === 'images.example.test'
    )
      return route.fulfill({ contentType: 'image/png', body: png })
    if (request.resourceType() === 'image' && path.startsWith('/uploads/'))
      return path.includes('broken')
        ? route.fulfill({ status: 404, body: '' })
        : route.fulfill({ contentType: 'image/png', body: png })
    if (!['fetch', 'xhr'].includes(request.resourceType()))
      return route.continue()
    if (!/^\/(auth|users|uploads|notifications|socket\.io)(\/|$)/.test(path))
      return route.continue()
    let body: unknown = { items: [] }
    const present = (user: typeof profile) => ({
      ...user,
      avatarUrl: user.avatarUrl || defaultAvatar,
    })
    if (path === '/auth/me') {
      if (request.method() === 'PATCH') {
        const data = request.postDataJSON()
        state.updates.push(data)
        Object.assign(profile, data)
      }
      body = present(profile)
    } else if (path === '/users') body = { items: members.map(present) }
    else if (path.startsWith('/users/') && request.method() === 'PATCH') {
      const member = members.find((user) => user.id === path.split('/').pop())!
      const data = request.postDataJSON()
      state.updates.push(data)
      Object.assign(member, data)
      body = present(member)
    } else if (path === '/uploads') {
      state.uploads++
      await new Promise((resolve) => setTimeout(resolve, 200))
      if (state.failUpload)
        return route.fulfill({
          status: 500,
          json: { message: 'Upload failed' },
        })
      body = { url: '/uploads/avatar.png' }
    }
    return route.fulfill({ json: body })
  })
  return state
}

test('members preview the animal default, upload an avatar, and reset it persistently', async ({
  page,
}) => {
  const state = await mockAvatars(page)
  await page.goto('/settings')
  await expect(
    page.getByText('Default animal avatar · Images up to 5 MB'),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Use default avatar' }),
  ).toBeDisabled()
  await page
    .getByLabel('Upload avatar')
    .setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png })
  await expect(
    page.getByRole('button', { name: 'Save profile', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByText('Custom avatar · Images up to 5 MB'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect.poll(() => state.profile.avatarUrl).toBe('/uploads/avatar.png')
  await page.reload()
  await expect(
    page.getByText('Custom avatar · Images up to 5 MB'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Use default avatar' }).click()
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect.poll(() => state.updates.at(-1)?.avatarUrl).toBeNull()
  await page.reload()
  await expect(
    page.getByText('Default animal avatar · Images up to 5 MB'),
  ).toBeVisible()
  await expect
    .poll(() =>
      page
        .getByRole('img', { name: "Team Member's avatar" })
        .last()
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true)
  await page.screenshot({
    path: '/private/tmp/teamorbit-avatar-settings.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: '/private/tmp/teamorbit-avatar-settings-mobile.png',
    fullPage: true,
  })
})

test('an admin can set and reset another member avatar without editing a superuser', async ({
  page,
}) => {
  const state = await mockAvatars(page, 'ADMIN')
  await page.goto('/users')
  await expect(
    page.getByRole('button', { name: 'Edit avatar for Super Admin' }),
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Edit avatar for Other Member' })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog
    .getByLabel('Upload avatar')
    .setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png })
  await expect(
    dialog.getByRole('button', { name: 'Save avatar' }),
  ).toBeEnabled()
  await dialog.getByRole('button', { name: 'Save avatar' }).click()
  await expect
    .poll(() => state.members[1].avatarUrl)
    .toBe('/uploads/avatar.png')
  await page
    .getByRole('button', { name: 'Edit avatar for Other Member' })
    .click()
  await dialog.getByRole('button', { name: 'Use default avatar' }).click()
  await dialog.getByRole('button', { name: 'Save avatar' }).click()
  await expect.poll(() => state.members[1].avatarUrl).toBeNull()
})

test('failed and oversized uploads keep the existing avatar', async ({
  page,
}) => {
  const state = await mockAvatars(page, 'USER', '/uploads/existing.png')
  state.failUpload = true
  await page.goto('/settings')
  await page
    .getByLabel('Upload avatar')
    .setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByText('Upload failed', { exact: true })).toBeVisible()
  await page
    .getByLabel('Upload avatar')
    .setInputFiles({
      name: 'large.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    })
  await expect(
    page.getByText('Images must be 5 MB or smaller', { exact: true }),
  ).toBeVisible()
  expect(state.uploads).toBe(1)
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect
    .poll(() => state.updates.at(-1)?.avatarUrl)
    .toBe('/uploads/existing.png')
})

test('broken custom avatars display the animal fallback', async ({ page }) => {
  await mockAvatars(page, 'USER', '/uploads/broken.png')
  await page.goto('/settings')
  await expect(
    page.getByRole('img', { name: "Team Member's avatar" }).last(),
  ).toHaveAttribute('src', '/avatars/default-raven.png')
})

test('presets are selectable, persist after reload, and can be reset to the raven', async ({
  page,
}) => {
  const state = await mockAvatars(page)
  await page.goto('/settings')
  await expect(
    page.getByRole('group', { name: 'Preset avatars' }).getByRole('button'),
  ).toHaveCount(catalogue.length)
  const owl = page.getByRole('button', { name: 'Select Frazzled Owl avatar' })
  await owl.click()
  await expect(owl).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect.poll(() => state.profile.avatarUrl).toBe(catalogue[1].url)
  await page.reload()
  await expect(owl).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(() =>
      page
        .getByRole('group', { name: 'Preset avatars' })
        .locator('img')
        .evaluateAll(
          (images) =>
            images.filter(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ).length,
        ),
    )
    .toBe(catalogue.length)
  await page.screenshot({
    path: '/private/tmp/teamorbit-avatar-presets.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: '/private/tmp/teamorbit-avatar-presets-mobile.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Select Grumpy Raven avatar' }).click()
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect.poll(() => state.profile.avatarUrl).toBeNull()
})

test('external image links validate their scheme, preview, and persist', async ({
  page,
}) => {
  const state = await mockAvatars(page)
  await page.goto('/settings')
  const input = page.getByRole('textbox', { name: 'External avatar image URL' })
  for (const invalid of [
    'not-a-url',
    'javascript:alert(1)',
    'data:image/png;base64,invalid',
  ]) {
    await input.fill(invalid)
    await page.getByRole('button', { name: 'Use image link' }).click()
    await expect(page.getByRole('alert')).toContainText('http:// or https://')
    expect(state.updates).toHaveLength(0)
  }
  await input.fill('https://images.example.test/my-bird.png')
  await input.press('Enter')
  expect(state.updates).toHaveLength(0)
  await expect(
    page.getByRole('img', { name: "Team Member's avatar" }).last(),
  ).toHaveAttribute('src', 'https://images.example.test/my-bird.png')
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect
    .poll(() => state.profile.avatarUrl)
    .toBe('https://images.example.test/my-bird.png')
  await page.reload()
  await expect(
    page.getByRole('img', { name: "Team Member's avatar" }).last(),
  ).toHaveAttribute('src', 'https://images.example.test/my-bird.png')
})

test('admins can assign a preset and an external link to another user', async ({
  page,
}) => {
  const state = await mockAvatars(page, 'ADMIN')
  await page.goto('/users')
  await page
    .getByRole('button', { name: 'Edit avatar for Other Member' })
    .click()
  let dialog = page.getByRole('dialog')
  await dialog
    .getByRole('button', { name: 'Select Scheming Fox avatar' })
    .click()
  await dialog.getByRole('button', { name: 'Save avatar' }).click()
  await expect.poll(() => state.members[1].avatarUrl).toBe(catalogue[3].url)
  await page
    .getByRole('button', { name: 'Edit avatar for Other Member' })
    .click()
  dialog = page.getByRole('dialog')
  await dialog
    .getByRole('textbox', { name: 'External avatar image URL' })
    .fill('https://images.example.test/other.png')
  await dialog.getByRole('button', { name: 'Use image link' }).click()
  await dialog.getByRole('button', { name: 'Save avatar' }).click()
  await expect
    .poll(() => state.members[1].avatarUrl)
    .toBe('https://images.example.test/other.png')
})

test('external links remain available when the preset catalogue fails', async ({
  page,
}) => {
  const state = await mockAvatars(page)
  state.failPresets = true
  await page.goto('/settings')
  await expect(
    page.getByRole('button', { name: 'Retry portraits' }),
  ).toBeVisible()
  await page
    .getByRole('textbox', { name: 'External avatar image URL' })
    .fill('https://images.example.test/custom.png')
  await page.getByRole('button', { name: 'Use image link' }).click()
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect
    .poll(() => state.profile.avatarUrl)
    .toBe('https://images.example.test/custom.png')
})
