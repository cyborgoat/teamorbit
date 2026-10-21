import { mockSocket } from './mock-socket'
import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const member = {
  id: 'member',
  fullName: 'Team Member',
  username: 'member',
  email: 'member@test.local',
  role: 'USER',
  status: 'ACTIVE',
}
const admin = { ...member, id: 'admin', fullName: 'Team Admin', role: 'ADMIN' }
const superuser = {
  ...member,
  id: 'super',
  fullName: 'Super Admin',
  role: 'SUPERUSER',
}

async function mockApi(page: Page, initial = superuser) {
  const state = {
    profile: { ...initial },
    users: [{ ...superuser }, { ...admin }, { ...member }],
    uploads: 0,
    failUpload: false,
    failPublish: false,
    posts: [] as Record<string, unknown>[],
  }
  page.on('pageerror', (error) =>
    console.error('Browser error:', error.message),
  )
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
    if (
      request.resourceType() === 'image' &&
      new URL(request.url()).pathname
        .replace(/^\/api(?=\/)/, '')
        .startsWith('/uploads/')
    ) {
      return route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="#d6eae4"/><text x="70" y="65" fill="#244d42">Team photo</text></svg>',
      })
    }
    if (!['fetch', 'xhr'].includes(request.resourceType()))
      return route.continue()
    const path = new URL(request.url()).pathname.replace(/^\/api(?=\/)/, '')
    if (
      !/^\/(auth|users|news|blog-posts|forum-posts|comments|notifications|uploads|socket\.io)(\/|$)/.test(
        path,
      )
    )
      return route.continue()
    let body: unknown = { items: [] }
    if (path === '/auth/me') body = state.profile
    else if (path === '/forum-posts/thread' && request.method() === 'GET')
      body = {
        id: 'thread',
        title: 'Discussion',
        content: 'A post',
        author: member,
        createdAt: '2026-10-16T00:00:00Z',
        score: 0,
        myVote: 0,
        comments: [],
      }
    else if (path === '/comments' && request.method() === 'GET')
      body = {
        items: [
          {
            id: 'comment',
            content: 'Existing comment',
            resourceType: 'forum',
            resourceId: 'thread',
            author: member,
            createdAt: '2026-10-16T00:00:00Z',
            score: 0,
            myVote: 0,
            replies: [],
          },
        ],
      }
    else if (path === '/comments' && request.method() === 'POST') {
      state.posts.push(request.postDataJSON())
      body = { id: 'created-comment', replies: [] }
    } else if (path === '/users') body = { items: state.users }
    else if (path.startsWith('/users/') && request.method() === 'PATCH') {
      const target = state.users.find(
        (user) => user.id === path.split('/').pop(),
      )!
      Object.assign(target, request.postDataJSON())
      if (target.id === state.profile.id) state.profile = { ...target }
      body = target
    } else if (path === '/uploads') {
      state.uploads++
      await new Promise((resolve) => setTimeout(resolve, 250))
      if (state.failUpload && state.uploads === 1)
        return route.fulfill({
          status: 500,
          json: { message: 'Upload failed' },
        })
      body = { url: `/uploads/image-${state.uploads}.png` }
    } else if (
      ['/news', '/blog-posts', '/forum-posts'].includes(path) &&
      request.method() === 'POST'
    ) {
      state.posts.push(request.postDataJSON())
      if (state.failPublish)
        return route.fulfill({
          status: 500,
          json: { message: 'Publish failed' },
        })
      body = { id: 'created' }
    }
    await route.fulfill({ json: body })
  })
  return state
}

async function pasteImages(page: Page, count = 1, editorIndex = 0) {
  await page
    .locator('[contenteditable="true"]')
    .nth(editorIndex)
    .evaluate((element, count) => {
      const data = new DataTransfer()
      const bytes = Uint8Array.from(
        atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZQAAAABJRU5ErkJggg==',
        ),
        (char) => char.charCodeAt(0),
      )
      for (let index = 0; index < count; index++)
        data.items.add(
          new File([bytes], `image-${index}.png`, { type: 'image/png' }),
        )
      element.dispatchEvent(
        new ClipboardEvent('paste', {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      )
    }, count)
}

test('superuser can change a role and admin can only promote members', async ({
  page,
}) => {
  const state = await mockApi(page)
  await page.goto('/users')
  await page.getByRole('combobox', { name: 'Role for Team Member' }).click()
  await page.getByRole('option', { name: 'ADMIN', exact: true }).click()
  await expect(page.getByText('User role updated')).toBeVisible()
  expect(state.users.find((user) => user.id === 'member')?.role).toBe('ADMIN')
  state.profile = { ...admin }
  state.users.find((user) => user.id === 'member')!.role = 'USER'
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
  // Reload also verifies role controls are derived from the authenticated profile.
  await page.reload()
  await expect(
    page.getByRole('combobox', { name: 'Role for Team Admin' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('combobox', { name: 'Role for Super Admin' }),
  ).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Role for Team Member' }).click()
  await expect(
    page.getByRole('option', { name: 'SUPERUSER', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('option', { name: 'ADMIN', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: 'Role for Team Member' }),
  ).toHaveCount(0)
})

test('profile polling removes admin controls after demotion without re-login', async ({
  page,
}) => {
  const state = await mockApi(page, admin)
  await page.clock.install()
  await page.goto('/news')
  await expect(page.getByRole('link', { name: 'New article' })).toBeVisible()
  state.profile = { ...member }
  await page.clock.fastForward(30_100)
  await expect(page.getByRole('link', { name: 'New article' })).toHaveCount(0)
})

for (const kind of ['news', 'blog', 'forum']) {
  test(`${kind} has a standalone editor with toolbar and publishes Markdown`, async ({
    page,
  }) => {
    const state = await mockApi(page)
    await page.goto(`/${kind}/new`)
    await expect(page.getByRole('heading', { name: /^New/ })).toBeVisible()
    await expect(page.getByRole('toolbar')).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByLabel('Title', { exact: true }).fill('Test post')
    const editor = page.locator('[contenteditable="true"]').first()
    await editor.fill('Text before image')
    await pasteImages(page, 2)
    await expect(
      page.getByRole('button', { name: 'Uploading…', exact: true }),
    ).toBeDisabled()
    await editor.press('End')
    await page.keyboard.type(' text typed during upload')
    await expect(
      page.getByRole('button', { name: 'Publish', exact: true }),
    ).toBeEnabled()
    await expect
      .poll(() =>
        page
          .locator('.orbit-editor img[src^="/uploads/"]')
          .evaluateAll(
            (images) =>
              images.filter(
                (image) =>
                  (image as HTMLImageElement).complete &&
                  (image as HTMLImageElement).naturalWidth > 0,
              ).length,
          ),
      )
      .toBe(2)
    if (kind === 'news')
      await page.screenshot({
        path: '/private/tmp/teamorbit-editor.png',
        fullPage: true,
      })
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/${kind}/?$`))
    const content = state.posts[0].content as string
    expect(content).toContain('Text before image')
    expect(content).toContain('text typed during upload')
    expect(content).toContain('/uploads/image-1.png')
    expect(content).toContain('/uploads/image-2.png')
    expect(content.indexOf('image-1.png')).toBeLessThan(
      content.indexOf('image-2.png'),
    )
    expect(content).not.toContain('blob:')
  })
}

test('failed image does not discard a successful sibling or draft', async ({
  page,
}) => {
  const state = await mockApi(page)
  state.failUpload = true
  state.failPublish = true
  await page.goto('/news/new')
  await page.getByLabel('Title', { exact: true }).fill('Retained draft')
  await page.locator('[contenteditable="true"]').first().fill('Keep this text')
  await pasteImages(page, 2)
  await expect(
    page.getByRole('button', { name: 'Publish', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByText('Publish failed', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
    'Retained draft',
  )
  expect(state.posts[0].content).toContain('Keep this text')
  expect(state.posts[0].content).toContain('/uploads/image-2.png')
  expect(state.posts[0].content).not.toContain('blob:')
})

test('regular members cannot directly open news or blog creation', async ({
  page,
}) => {
  await mockApi(page, member)
  for (const kind of ['news', 'blog']) {
    await page.goto(`/${kind}/new`)
    await expect(page.getByText('You do not have permission')).toBeVisible()
    await expect(page.getByRole('toolbar')).toHaveCount(0)
  }
})

test('source mode, ordinary text paste, cancel and editor reload work', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto('/blog/new')
  const editor = page.getByRole('textbox', { name: 'Markdown content' })
  await editor.fill('Original text')
  await editor.evaluate((element) => {
    const data = new DataTransfer()
    data.setData('text/plain', ' pasted text')
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    )
  })
  await expect(editor).toContainText('pasted text')
  await page.getByRole('radio', { name: 'Source mode', exact: true }).click()
  await expect(page.locator('.cm-content')).toContainText('Original text')
  await page.getByRole('link', { name: 'Cancel', exact: true }).click()
  await expect(page).toHaveURL(/\/blog\/?$/)
  await page.getByRole('link', { name: 'New post' }).click()
  await page.reload()
  await expect(page.getByRole('toolbar')).toBeVisible()
})

test('inline comments and replies upload images and reset after posting', async ({
  page,
}) => {
  const state = await mockApi(page, member)
  await page.goto('/forum/thread')
  const comment = page
    .getByRole('textbox', { name: 'Markdown content' })
    .first()
  await comment.fill('Comment draft')
  await pasteImages(page)
  await expect(
    page.getByRole('button', { name: 'Post comment', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Post comment', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Post comment', exact: true }).click()
  await expect(comment).toBeEmpty()
  expect(state.posts[0].content).toContain('/uploads/image-1.png')
  await page.getByRole('button', { name: 'Reply', exact: true }).click()
  const reply = page.getByRole('textbox', { name: 'Markdown content' }).nth(1)
  await reply.fill('Reply draft')
  await pasteImages(page, 1, 1)
  await expect(
    page.getByRole('button', { name: 'Post reply', exact: true }),
  ).toBeEnabled()
  await page.getByRole('button', { name: 'Post reply', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Post reply', exact: true }),
  ).toHaveCount(0)
  expect(state.posts[1]).toMatchObject({ parentId: 'comment' })
  expect(state.posts[1].content).toContain('/uploads/image-2.png')
})

test('oversized pasted images are rejected before upload', async ({ page }) => {
  const state = await mockApi(page)
  await page.goto('/news/new')
  const editor = page.getByRole('textbox', { name: 'Markdown content' })
  await editor.fill('Keep this draft')
  await editor.evaluate((element) => {
    const data = new DataTransfer()
    data.items.add(
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', {
        type: 'image/png',
      }),
    )
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    )
  })
  await expect(
    page.getByText('Images must be 5 MB or smaller', { exact: true }),
  ).toBeVisible()
  await expect(editor).toContainText('Keep this draft')
  expect(state.uploads).toBe(0)
})
