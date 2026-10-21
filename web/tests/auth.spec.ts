import { mockSocket } from './mock-socket'
import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function mockAuth(page: Page, initialToken = false) {
  const state = {
    login: null as Record<string, unknown> | null,
    registration: null as Record<string, unknown> | null,
    profile: {
      id: 'member',
      username: 'member',
      fullName: 'Team Member',
      email: null as string | null,
      role: 'USER',
      status: 'ACTIVE',
    },
  }
  if (initialToken)
    await page.addInitScript(() =>
      localStorage.setItem('teamorbit-token', 'test-token'),
    )
  await mockSocket(page)
  await page.route('**/*', async (route) => {
    const request = route.request()
    if (
      new URL(request.url()).pathname.replace(/^\/api(?=\/)/, '') === '/avatars'
    )
      return route.fulfill({ json: { items: [] } })
    if (
      new URL(request.url()).pathname.replace(/^\/api(?=\/)/, '') ===
      '/avatars/default-raven.png'
    )
      return route.fulfill({
        contentType: 'image/png',
        body: await readFile(
          new URL(
            '../../api/src/assets/avatars/default-raven.png',
            import.meta.url,
          ),
        ),
      })
    if (!['fetch', 'xhr'].includes(request.resourceType()))
      return route.continue()
    const path = new URL(request.url()).pathname.replace(/^\/api(?=\/)/, '')
    if (
      !/^\/(auth|news|blog-posts|forum-posts|notifications|announcements|events|socket\.io)(\/|$)/.test(
        path,
      )
    )
      return route.continue()
    let body: unknown = { items: [] }
    if (path === '/auth/login') {
      state.login = request.postDataJSON()
      body = { accessToken: 'test-token', user: state.profile }
    } else if (path === '/auth/register') {
      state.registration = request.postDataJSON()
      body = { ...state.profile, status: 'PENDING' }
    } else if (path === '/auth/me') {
      if (request.method() === 'PATCH')
        Object.assign(state.profile, request.postDataJSON())
      body = state.profile
    }
    await route.fulfill({ json: body })
  })
  return state
}

test('login defaults to username and sends username/password', async ({
  page,
}) => {
  const state = await mockAuth(page)
  await page.goto('/login')
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue('')
  await page.getByLabel('Username', { exact: true }).fill('member')
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/')
  expect(state.login).toEqual({ username: 'member', password: 'password123' })
})

test('email remains an explicit login option', async ({ page }) => {
  const state = await mockAuth(page)
  await page.goto('/login')
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email', { exact: true }).fill('member@example.com')
  await page.getByLabel('Password', { exact: true }).fill('password123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/')
  expect(state.login).toEqual({
    email: 'member@example.com',
    password: 'password123',
  })
})

for (const email of ['', 'member@example.com']) {
  test(`registration ${email ? 'accepts optional email' : 'does not require email'}`, async ({
    page,
  }) => {
    const state = await mockAuth(page)
    await page.goto('/register')
    await page.getByLabel('Username', { exact: true }).fill('new-member')
    await page.getByLabel('Full name', { exact: true }).fill('New Member')
    await page.getByLabel('Password', { exact: true }).fill('password123')
    await expect(
      page.getByLabel('Email (optional)', { exact: true }),
    ).not.toHaveAttribute('required')
    if (email)
      await page.getByLabel('Email (optional)', { exact: true }).fill(email)
    await page
      .getByRole('button', { name: 'Create account', exact: true })
      .click()
    await expect(page).toHaveURL('/login')
    expect(state.registration).toEqual({
      username: 'new-member',
      fullName: 'New Member',
      password: 'password123',
      ...(email ? { email } : {}),
    })
  })
}

test('settings handles an account without email and allows adding or removing one', async ({
  page,
}) => {
  const state = await mockAuth(page, true)
  await page.goto('/settings')
  const email = page.getByLabel('Email (optional)', { exact: true })
  await expect(email).toHaveValue('')
  await email.fill('member@example.com')
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect(page.getByText('Profile updated', { exact: true })).toBeVisible()
  expect(state.profile.email).toBe('member@example.com')
  await email.fill('')
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await expect.poll(() => state.profile.email).toBeNull()
})
