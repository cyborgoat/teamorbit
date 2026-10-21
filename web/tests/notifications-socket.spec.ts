import { test, expect } from '@playwright/test'

test('Strict Mode opens one notification connection, receives updates, and reconnects', async ({
  page,
}) => {
  const user = {
    id: 'member',
    username: 'member',
    fullName: 'Team Member',
    email: null,
    role: 'USER',
    status: 'ACTIVE',
    avatarUrl: null,
  }
  let connections = 0
  let notificationRequests = 0
  let dropConnection: (() => void) | undefined
  let notify: (() => void) | undefined
  const tokens: string[] = []
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.addInitScript(() =>
    localStorage.setItem('teamorbit-token', 'test-token'),
  )
  await page.route('**/*', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace(/^\/api(?=\/)/, '')
    if (path === '/avatars/default-raven.png')
      return route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>',
      })
    if (!['fetch', 'xhr'].includes(request.resourceType()))
      return route.continue()
    if (path === '/auth/me') return route.fulfill({ json: user })
    if (path === '/notifications') notificationRequests++
    if (
      [
        '/news',
        '/blog-posts',
        '/forum-posts',
        '/comments',
        '/events',
        '/announcements',
        '/notifications',
      ].includes(path)
    )
      return route.fulfill({ json: { items: [] } })
    return route.continue()
  })
  await page.routeWebSocket(/\/socket\.io\//, (socket) => {
    connections++
    socket.send(
      '0' +
        JSON.stringify({
          sid: `engine-${connections}`,
          upgrades: [],
          pingInterval: 25000,
          pingTimeout: 20000,
          maxPayload: 1000000,
        }),
    )
    socket.onMessage((message) => {
      if (!message.toString().startsWith('40')) return
      tokens.push(JSON.parse(message.toString().slice(2)).token)
      socket.send('40' + JSON.stringify({ sid: `socket-${connections}` }))
      dropConnection = () => socket.close()
      notify = () =>
        socket.send(
          '42' +
            JSON.stringify([
              'notification:new',
              {
                title: 'A teammate posted an update',
                body: 'Open the forum to read it.',
              },
            ]),
        )
    })
  })
  await page.goto('/')
  await expect.poll(() => tokens.length).toBe(1)
  expect(connections).toBe(1)
  expect(tokens).toEqual(['test-token'])
  await expect.poll(() => notificationRequests).toBeGreaterThan(0)
  const before = notificationRequests
  notify!()
  await expect(
    page.getByText('A teammate posted an update', { exact: true }),
  ).toBeVisible()
  await expect.poll(() => notificationRequests).toBeGreaterThan(before)

  dropConnection!()
  await expect.poll(() => tokens.length).toBe(2)
  expect(tokens).toEqual(['test-token', 'test-token'])
  expect(
    errors.filter((message) => /closed before|WebSocket.*failed/.test(message)),
  ).toEqual([])
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login/)
})
