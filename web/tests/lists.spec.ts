import { test, expect } from '@playwright/test'
import { mockSocket } from './mock-socket'

for (const kind of ['news', 'blog']) {
  test(`${kind} paginates and opens previews with the keyboard`, async ({
    page,
  }) => {
    await mockSocket(page)
    await page.addInitScript(() =>
      localStorage.setItem('teamorbit-token', 'list-token'),
    )
    const pages: number[] = []
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname === '/api/auth/me')
        return route.fulfill({
          json: {
            id: 'admin',
            username: 'admin',
            fullName: 'Admin',
            email: null,
            role: 'ADMIN',
            status: 'ACTIVE',
            avatarUrl: null,
          },
        })
      if (
        url.pathname === (kind === 'blog' ? '/api/blog-posts' : '/api/news')
      ) {
        const number = Number(url.searchParams.get('page'))
        pages.push(number)
        return route.fulfill({
          json: {
            total: 21,
            page: number,
            limit: 20,
            items: [
              {
                id: `article-${number}`,
                title: `Article page ${number}`,
                content: '# Readable',
                tags: [],
                createdAt: '2026-10-16T00:00:00Z',
                coverImageUrl: null,
              },
            ],
          },
        })
      }
      return route.fulfill({ json: { items: [] } })
    })
    await page.goto(`/${kind}`)
    await expect(
      page.getByRole('button', { name: 'Previous', exact: true }),
    ).toBeDisabled()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible()
    const article = page.getByRole('button', {
      name: 'Article page 2',
      exact: true,
    })
    await article.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(
      page.getByRole('dialog').getByRole('heading', { name: 'Readable' }),
    ).toBeVisible()
    expect(pages).toEqual([1, 2])
  })
}

test('failed lists expose retry instead of an empty success state', async ({
  page,
}) => {
  await mockSocket(page)
  await page.addInitScript(() =>
    localStorage.setItem('teamorbit-token', 'list-token'),
  )
  let failing = true
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/auth/me')
      return route.fulfill({
        json: {
          id: 'admin',
          username: 'admin',
          fullName: 'Admin',
          email: null,
          role: 'ADMIN',
          status: 'ACTIVE',
          avatarUrl: null,
        },
      })
    if (url.pathname === '/api/blog-posts' && failing)
      return route.fulfill({
        status: 500,
        json: { message: 'Service unavailable' },
      })
    return route.fulfill({ json: { total: 0, page: 1, limit: 20, items: [] } })
  })
  await page.goto('/blog')
  await expect(page.getByRole('alert')).toContainText('Service unavailable', {
    timeout: 15000,
  })
  await expect(page.getByText('No articles yet')).toHaveCount(0)
  failing = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByText('No articles yet')).toBeVisible()
})
