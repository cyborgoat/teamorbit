import { mockSocket } from './mock-socket'
import { test, expect, type Locator, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import {
  blogContent,
  newsContent,
} from '../../api/test/fixtures/demo/seed-content'

const author = {
  id: 'member',
  username: 'member',
  fullName: 'Team Member',
  role: 'SUPERUSER',
  status: 'ACTIVE',
}
const createdAt = '2026-10-16T00:00:00Z'
const markdown = [
  '# GFM sample',
  '**Strong** and *emphasis*, ~~outdated~~, and `literal $code$`.',
  '| Left | Center | Right |\n| :--- | :---: | ---: |\n| left \\| right | `x\\|y` | 42 |',
  '- [x] Completed\n- [ ] Pending',
  '1. First\n   - Nested item\n2. Second',
  '> A useful quotation.',
  '[Reference link][gfm]\n\n[gfm]: https://github.github.com/gfm/ "GFM specification"',
  'Autolink: https://github.github.com/gfm/',
  '[![Orbit illustration](/uploads/demo/orbit.svg "Orbit demo")](/uploads/demo/orbit.svg)',
  '```ts\nconst ready = true;\nconst formula = "$not_math$";\n```',
  'Inline math: $E = mc^2$.',
  String.raw`$$
\begin{aligned}
\bar{x} &= \frac{1}{n}\sum_{i=1}^{n}x_i \\
A &= \begin{bmatrix}1 & 0 \\ 0 & 1\end{bmatrix}
\end{aligned}
$$`,
  String.raw`Invalid formula stays readable: $\frac{1}{$.`,
  String.raw`Untrusted command: $\href{javascript:alert(1)}{unsafe}$.`,
  '<script>window.__markdownExecuted = true</script>',
].join('\n\n')

async function mockMarkdownApi(
  page: Page,
  content = markdown,
  articles?: typeof newsContent,
) {
  const published: { content: string }[] = []
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
    const image = /^\/uploads\/demo\/(orbit|metrics|workshop)\.svg$/.exec(
      new URL(request.url()).pathname.replace(/^\/api(?=\/)/, ''),
    )
    if (image) {
      return route.fulfill({
        contentType: 'image/svg+xml',
        body: await readFile(
          new URL(
            `../../api/test/fixtures/demo/assets/${image[1]}.svg`,
            import.meta.url,
          ),
        ),
      })
    }
    if (!['fetch', 'xhr'].includes(request.resourceType()))
      return route.continue()
    const path = new URL(request.url()).pathname.replace(/^\/api(?=\/)/, '')
    if (
      !/^\/(auth|news|blog-posts|forum-posts|comments|notifications|socket\.io)(\/|$)/.test(
        path,
      )
    )
      return route.continue()
    let body: unknown = { items: [] }
    if (path === '/auth/me') body = author
    else if (path === '/comments' && request.method() === 'GET')
      body = {
        items: [
          {
            id: 'comment',
            content,
            resourceType: 'forum',
            resourceId: 'thread',
            author,
            createdAt,
            score: 0,
            myVote: 0,
            replies: [
              {
                id: 'reply',
                content,
                resourceType: 'forum',
                resourceId: 'thread',
                author,
                createdAt,
                score: 0,
                myVote: 0,
              },
            ],
          },
        ],
      }
    else if (request.method() === 'POST') {
      published.push(request.postDataJSON())
      body = { id: 'created', replies: [] }
    } else if (path === '/news' || path === '/blog-posts')
      body = {
        items: (
          articles ?? [{ title: 'Markdown sample', content, tags: ['gfm'] }]
        ).map((article, index) => ({
          ...article,
          id: `article-${index}`,
          createdAt,
        })),
      }
    else if (path === '/forum-posts/thread')
      body = {
        id: 'thread',
        title: 'Markdown discussion',
        content,
        author,
        createdAt,
        score: 0,
        myVote: 0,
        comments: [],
      }
    await route.fulfill({ json: body })
  })
  return published
}

async function expectRichMarkdown(body: Locator) {
  await expect(body.getByRole('heading', { name: 'GFM sample' })).toBeVisible()
  await expect(body.locator('strong')).toHaveText('Strong')
  await expect(body.locator('em')).toHaveText('emphasis')
  await expect(body.locator('del')).toHaveText('outdated')
  await expect(body.locator('tbody td').nth(0)).toHaveText('left | right')
  await expect(body.locator('tbody td').nth(1)).toHaveText('x|y')
  await expect(body.locator('tbody td').nth(1)).toHaveCSS(
    'text-align',
    'center',
  )
  await expect(body.locator('tbody td').nth(2)).toHaveCSS('text-align', 'right')
  await expect(body.locator('input[type=checkbox]')).toHaveCount(2)
  await expect(body.locator('input[type=checkbox]').first()).toBeChecked()
  await expect(body.locator('input[type=checkbox]').first()).toBeDisabled()
  await expect(body.locator('ol ul li')).toHaveText('Nested item')
  await expect(body.locator('blockquote')).toContainText('A useful quotation.')
  await expect(
    body.getByRole('link', { name: 'Reference link' }),
  ).toHaveAttribute('href', 'https://github.github.com/gfm/')
  await expect(
    body.getByRole('link', { name: 'https://github.github.com/gfm/' }),
  ).toHaveCount(1)
  const image = body.getByRole('img', { name: 'Orbit illustration' })
  await expect(image).toHaveAttribute('title', 'Orbit demo')
  await expect
    .poll(() =>
      image.evaluate(
        (element: HTMLImageElement) =>
          element.complete && element.naturalWidth > 0,
      ),
    )
    .toBe(true)
  await expect(body.locator('a:has(img)')).toHaveAttribute(
    'href',
    '/uploads/demo/orbit.svg',
  )
  await expect(body.locator('pre code.language-ts')).toContainText(
    'const formula = "$not_math$";',
  )
  await expect(body.locator('pre .katex')).toHaveCount(0)
  await expect(body.locator('.katex-display')).toHaveCount(1)
  await expect(body.locator('.katex')).toHaveCount(3)
  await expect(body.locator('.katex-error')).toContainText(
    String.raw`\frac{1}{`,
  )
  await expect(body.locator('a[href^="javascript:"]')).toHaveCount(0)
  await expect(body.locator('script')).toHaveCount(0)
}

for (const kind of ['news', 'blog']) {
  test(`${kind} renders GFM and math without changing the source`, async ({
    page,
  }) => {
    await mockMarkdownApi(page)
    await page.goto(`/${kind}`)
    await page.getByText('Markdown sample', { exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expectRichMarkdown(dialog.locator('.markdown-body'))
    await dialog.getByRole('button', { name: 'Source', exact: true }).click()
    await expect(dialog.locator('pre')).toHaveText(markdown)
    await dialog.getByRole('button', { name: 'View', exact: true }).click()
    await expect(dialog.locator('.katex-display')).toHaveCount(1)
  })

  test(`${kind} seeded articles render with valid math and local images`, async ({
    page,
  }) => {
    const articles = kind === 'news' ? newsContent : blogContent
    await mockMarkdownApi(page, '', articles)
    await page.goto(`/${kind}`)
    for (const article of articles) {
      await page.getByText(article.title, { exact: true }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.locator('.markdown-body')).toContainText(
        article.content.split('\n')[0].replace(/^#+ /, ''),
      )
      await expect(dialog.locator('.katex-error')).toHaveCount(0)
      for (const image of await dialog.locator('img').all()) {
        await expect
          .poll(() =>
            image.evaluate(
              (element: HTMLImageElement) =>
                element.complete && element.naturalWidth > 0,
            ),
          )
          .toBe(true)
      }
      await page.keyboard.press('Escape')
    }
  })
}

test('forum posts, comments, and replies use the same Markdown renderer', async ({
  page,
}) => {
  await mockMarkdownApi(page)
  await page.goto('/forum/thread')
  const bodies = page
    .locator('.markdown-body')
    .filter({ has: page.getByRole('heading', { name: 'GFM sample' }) })
  await expect(bodies).toHaveCount(3)
  for (const body of await bodies.all()) await expectRichMarkdown(body)
  await page.getByRole('button', { name: 'Source', exact: true }).click()
  await expect(
    page.locator('pre').filter({ hasText: '# GFM sample' }).first(),
  ).toHaveText(markdown)
})

for (const kind of ['news', 'blog', 'forum']) {
  test(`${kind} creation previews and publishes formula source unchanged`, async ({
    page,
  }) => {
    const published = await mockMarkdownApi(page)
    await page.goto(`/${kind}/new`)
    await page.getByLabel('Title', { exact: true }).fill('Formula source')
    await page.getByRole('radio', { name: 'Source mode', exact: true }).click()
    const source = page.locator('.cm-content')
    await source.fill(markdown)
    await expectRichMarkdown(
      page
        .getByRole('region', { name: 'Post preview' })
        .locator('.markdown-body'),
    )
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect.poll(() => published.length).toBe(1)
    expect(published[0].content).toBe(markdown)
  })
}

test('wide tables, formulas, and code scroll inside a narrow preview', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const wide = [
    '| Column | Details |\n| --- | --- |\n| ' +
      'W'.repeat(90) +
      ' | A long table value |',
    '```txt\n' + 'wide_code_'.repeat(30) + '\n```',
    '$$\n' + 'x_1 + '.repeat(60) + 'x_2\n$$',
  ].join('\n\n')
  await mockMarkdownApi(page, wide)
  await page.goto('/news')
  await page.getByText('Markdown sample', { exact: true }).click()
  const body = page.getByRole('dialog').locator('.markdown-body')
  for (const selector of ['.markdown-table', 'pre', '.katex-display']) {
    const element = body.locator(selector)
    await expect(element).toBeVisible()
    expect(
      await element.evaluate((node) => node.scrollWidth > node.clientWidth),
      `${selector} should scroll`,
    ).toBe(true)
    await expect(element).toHaveCSS('overflow-x', 'auto')
  }
  expect(
    await page
      .getByRole('dialog')
      .evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
  ).toBe(true)
  await page.screenshot({
    path: '/private/tmp/teamorbit-markdown-mobile.png',
    fullPage: true,
  })
})

test('source to rich text transitions retain GFM and formula content', async ({
  page,
}) => {
  const published = await mockMarkdownApi(page)
  await page.goto('/blog/new')
  await page.getByLabel('Title', { exact: true }).fill('Round trip')
  await page.getByRole('radio', { name: 'Source mode', exact: true }).click()
  await page.locator('.cm-content').fill(markdown)
  await page.getByRole('radio', { name: 'Rich text', exact: true }).click()
  await page.getByRole('radio', { name: 'Source mode', exact: true }).click()
  await expectRichMarkdown(
    page
      .getByRole('region', { name: 'Post preview' })
      .locator('.markdown-body'),
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect.poll(() => published.length).toBe(1)
  expect(published[0].content).toContain('$E = mc^2$')
  expect(published[0].content).toContain('\\frac{1}{n}')
})
