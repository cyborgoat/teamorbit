import { test, expect, type Page } from '@playwright/test'
import { mockSocket } from './mock-socket'

async function setup(page: Page, role = 'ADMIN') {
  let posts = 0
  let polls = 0
  await page.addInitScript(() =>
    localStorage.setItem('teamorbit-token', 'test-token'),
  )
  await mockSocket(page)
  const report = () => ({
    items:
      posts && polls > 1
        ? []
        : [
            {
              path: 'demo/orphan.svg',
              size: 2048,
              state: 'ACTIVE',
              unreferencedAt: '2026-10-19T00:00:00Z',
              eligibleAt: '2026-10-20T00:00:00Z',
              eligible: true,
              error: null,
            },
          ],
    total: posts && polls > 1 ? 0 : 1,
    page: 1,
    limit: 20,
    orphanBytes: 2048,
    eligibleCount: 1,
    reclaimableBytes: 2048,
    settings: { enabled: true, intervalHours: 1, graceHours: 24 },
    lastRun: posts
      ? {
          id: 'run',
          trigger: 'manual',
          actorId: 'admin',
          status: polls > 1 ? 'COMPLETED' : 'RUNNING',
          startedAt: '2026-10-21T00:00:00Z',
          finishedAt: polls > 1 ? '2026-10-21T00:00:01Z' : null,
          deletedCount: polls > 1 ? 1 : 0,
          deletedBytes: polls > 1 ? 2048 : 0,
          failedCount: 0,
          error: null,
        }
      : null,
  })
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me')
      return route.fulfill({
        json: {
          id: 'admin',
          username: 'admin',
          fullName: 'Admin User',
          role,
          status: 'ACTIVE',
          email: null,
          avatarUrl: null,
        },
      })
    if (path === '/api/uploads/cleanup') {
      if (route.request().method() === 'POST') {
        posts++
        return route.fulfill({ status: 202, json: { id: 'run' } })
      }
      if (posts) polls++
      return route.fulfill({ json: report() })
    }
    return route.fulfill({ json: { items: [], total: 0, page: 1, limit: 20 } })
  })
  return { posts: () => posts }
}

test('admin previews, cancels, confirms cleanup, and sees progress and completion', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto('/upload-maintenance')
  await expect(
    page.getByRole('heading', { name: 'Upload maintenance', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('demo/orphan.svg', { exact: true })).toBeVisible()
  await expect(page.getByText(/Automatic cleanup: every 1 hour/)).toBeVisible()
  await page.getByRole('button', { name: 'Clean now', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText(
    'Unsaved drafts and external uses are not tracked',
  )
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(state.posts()).toBe(0)
  await page.getByRole('button', { name: 'Clean now', exact: true }).click()
  await page
    .getByRole('button', { name: 'Delete eligible uploads', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Cleanup running…', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByText('Status: COMPLETED.', { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByText('Deleted 1 files (2.0 KB); 0 failures.'),
  ).toBeVisible()
  expect(state.posts()).toBe(1)
})

test('ordinary members cannot see maintenance navigation or load the admin preview', async ({
  page,
}) => {
  await setup(page, 'USER')
  await page.goto('/upload-maintenance')
  await expect(page.getByRole('alert')).toHaveText(
    'Only administrators can manage upload cleanup.',
  )
  await expect(
    page.getByRole('link', { name: 'Upload maintenance', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Clean now', exact: true }),
  ).toHaveCount(0)
})
