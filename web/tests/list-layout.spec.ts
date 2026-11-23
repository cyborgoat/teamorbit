import { expect, test } from '@playwright/test'
import { mockSocket } from './mock-socket'

const admin = {
  id: 'manager',
  username: 'manager',
  fullName: 'Team Manager',
  role: 'ADMIN',
  status: 'ACTIVE',
}

for (const mobile of [false, true]) {
  test(`only list rows scroll on ${mobile ? 'mobile Users' : 'desktop Announcements'}`, async ({
    page,
  }) => {
    const name = mobile ? 'Users' : 'Announcements'
    const path = mobile ? '/users' : '/announcements'
    const column = mobile ? 'Member' : 'Title'
    await page.setViewportSize({ width: mobile ? 390 : 1100, height: 580 })
    await page.addInitScript(() =>
      localStorage.setItem('teamorbit-token', 'test-token'),
    )
    await mockSocket(page)
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname === '/api/auth/me') return route.fulfill({ json: admin })
      const current = Number(url.searchParams.get('page') ?? 1)
      const items =
        url.pathname === `/api${path}`
          ? Array.from({ length: 20 }, (_, index) => ({
              id: `record-${current}-${index}`,
              username: `member${index}`,
              fullName: `Member ${current}-${index}`,
              title: `Announcement ${current}-${index}`,
              description: 'Team update',
                author: admin,
              createdAt: '2026-11-23T00:00:00.000Z',
              role: 'USER',
              status: 'ACTIVE',
            }))
          : []
      return route.fulfill({
        json: { items, total: items.length * 2, page: current, limit: 20 },
      })
    })

    await page.goto(path)
    const region = page.getByRole('region', {
      name: `Scroll ${name.toLowerCase()}`,
    })
    const heading = page.getByRole('heading', { name, exact: true })
    const search = page.getByRole('searchbox')
    const header = page.getByRole('columnheader', { name: column })
    await expect(header).toBeVisible()
    const titleTop = (await heading.boundingBox())?.y
    const searchTop = (await search.boundingBox())?.y
    const columnTop = (await header.boundingBox())?.y
    const nav = page.getByRole('navigation', { name: 'Pagination' })
    const paginationTop = (await nav.boundingBox())?.y
    if (mobile) {
      expect(await region.evaluate((el) => el.scrollWidth)).toBe(
        await region.evaluate((el) => el.clientWidth),
      )
    }
    await region.hover()
    await page.mouse.wheel(0, 260)
    await expect
      .poll(() => region.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0)
    expect((await heading.boundingBox())?.y).toBe(titleTop)
    expect((await search.boundingBox())?.y).toBe(searchTop)
    expect((await header.boundingBox())?.y).toBe(columnTop)
    expect((await nav.boundingBox())?.y).toBe(paginationTop)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)

    await nav.getByRole('button', { name: 'Next' }).click()
    await expect(nav).toContainText('Page 2 of 2')
    await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBe(0)
  })
}
