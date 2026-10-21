// GFM content; dollar-delimited LaTeX is an explicitly supported extension.
const markdown = (...blocks: string[]) => blocks.join('\n\n');
const code = (language: string, source: string) =>
  `\`\`\`${language}\n${source}\n\`\`\``;

export const images = {
  orbit: '/uploads/demo/orbit.svg',
  workshop: '/uploads/demo/workshop.svg',
  metrics: '/uploads/demo/metrics.svg',
};

const table =
  '| Workstream | Owner | Progress |\n| :--- | :---: | ---: |\n| API | Platform | 92% |\n| Web | Experience | 84% |\n| Docs | Community | 76% |';

export const newsContent = [
  {
    title: 'Orbit launch: a shared space for the whole team',
    tags: ['release', 'team'],
    content: markdown(
      '# A new home for teamwork',
      '**teamorbit** brings updates, events, and thoughtful discussions into one place. Start with the *welcome checklist* below.',
      `[![Orbit launch illustration](${images.orbit} "Open the launch illustration")](${images.orbit})`,
      '## Launch readiness',
      table,
      '- [x] Invite the first cohort\n- [x] Publish the onboarding guide\n- [ ] Collect feedback from every time zone',
      '> Small, frequent updates help a distributed team stay connected.',
      '---',
      'Visit [the discussion forum](/forum) and introduce yourself. ~~Email every update~~ Subscribe to the topics you care about.',
    ),
  },
  {
    title: 'Developer preview: typed API responses',
    tags: ['engineering', 'api'],
    content: markdown(
      '## Fetch a page of news',
      'The example below uses the typed client. Keep credentials in your own local environment.',
      code(
        'ts',
        'const { items } = await orbit.news.list();\nfor (const article of items) {\n  console.log(article.title, article.tags);\n}',
      ),
      '### Example response',
      code(
        'json',
        '{\n  "items": [{ "title": "Orbit launch", "tags": ["release"] }],\n  "total": 1,\n  "page": 1,\n  "limit": 20\n}',
      ),
      'Use `items.length` for the current page and `total` for the complete result set.',
    ),
  },
  {
    title: 'Quarterly pulse: reading our engagement numbers',
    tags: ['metrics', 'community'],
    content: markdown(
      '## A fictional engagement snapshot',
      `![Activity chart illustration](${images.metrics})`,
      '| Week | Active members | Posts |\n| --- | ---: | ---: |\n| 1 | 42 | 18 |\n| 2 | 56 | 27 |\n| 3 | 63 | 35 |',
      String.raw`Participation is $p = \frac{63}{100} = 0.63$. This is a sample calculation, not live analytics.`,
      String.raw`$$
\bar{x} = \frac{1}{n}\sum_{i=1}^{n} x_i
$$`,
      '> Compare trends over several weeks before changing the team routine.',
    ),
  },
  {
    title: 'Workshop week: build, share, and learn',
    tags: ['events', 'learning'],
    content: markdown(
      '## Three sessions, one shared notebook',
      `![Workshop desks and presentation screen](${images.workshop} "Workshop week")`,
      '1. Bring a small problem from your current project.\n2. Pair with someone from another team.\n3. Share a short demo and one lesson learned.',
      '| Session | Format | Duration |\n| :--- | :---: | ---: |\n| API clinic | Pairing | 45 min |\n| Design critique | Roundtable | 30 min |\n| Demo hour | Lightning talks | 60 min |',
      'See [upcoming events](/events). Remote participants can join every session.',
    ),
  },
  {
    title: 'Documentation refresh and Markdown conventions',
    tags: ['docs', 'markdown'],
    content: markdown(
      '## Make updates easy to scan',
      'Use descriptive headings, meaningful image alt text, and language names on fenced code blocks.',
      '| Feature | Syntax example |\n| --- | --- |\n| Inline code | `const ready = true` |\n| Literal pipe | left \\| right |\n| Status | ~~draft~~ **published** |',
      'The [GFM specification][gfm] defines tables, task lists, strikethrough, and autolinks.',
      'Autolink sample: https://github.github.com/gfm/\n\n[gfm]: https://github.github.com/gfm/ "GitHub Flavored Markdown"',
      '> Math uses an additional LaTeX extension; it is not part of the GFM specification.',
    ),
  },
  {
    title: 'Maintenance rehearsal: a calm release checklist',
    tags: ['operations', 'release'],
    content: markdown(
      '## Rehearse before release day',
      '- [x] Check the health endpoint\n- [x] Confirm the migration plan\n- [ ] Assign a release observer\n- [ ] Write the follow-up note',
      code(
        'bash',
        'curl --fail http://localhost:3000/health\n# Expected: a successful health response',
      ),
      '> This is a fictional rehearsal notice. No production downtime is scheduled.',
      '### Owners',
      '| Task | Primary | Backup |\n| --- | --- | --- |\n| API checks | Maya | Noah |\n| UI smoke test | Lina | Alex |',
    ),
  },
  {
    title: 'Community digest: small wins worth sharing',
    tags: ['community'],
    content: markdown(
      '## This week around Orbit',
      '- **Design:** clearer empty states.\n- **Engineering:** faster local setup.\n- **Community:** a welcoming first discussion.',
      '> “A useful update tells the reader what changed and what to do next.”\n>\n> — The fictional Orbit editorial team',
      '### Share your own win',
      'Write a paragraph in the [forum](/forum), add an image if it helps, and thank someone who helped you.',
    ),
  },
  {
    title: 'Multilingual welcome: hello, 你好, مرحبًا',
    tags: [],
    content: markdown(
      '## Everyone belongs in the conversation',
      'Hello! 你好！こんにちは！안녕하세요! مرحبًا! 👋',
      'Names, messages, and code samples may contain Unicode. Please keep image descriptions useful for screen readers.',
      '- [x] Use descriptive link text\n- [ ] Add a short summary before a long technical explanation',
      'A literal marker stays literal: \\*this is not emphasis\\*. An inline snippet stays code: `$not_math$`.',
    ),
  },
];

export const blogContent = [
  {
    title: 'A field guide to readable team updates',
    tags: ['writing', 'markdown'],
    content: markdown(
      '# Write for the next reader',
      'A strong update starts with a decision or result. Use **bold** sparingly and *emphasis* for a useful nuance.',
      '## A repeatable outline',
      '1. State the result.\n2. Explain the evidence.\n3. Name the next action.\n   - Add an owner.\n   - Add a date when it matters.',
      table,
      '> Keep the details that help someone make a decision.',
      `![Orbit overview](${images.orbit})`,
      '---',
      'Read the [formatting reference](https://github.github.com/gfm/) for portable GFM examples.',
    ),
  },
  {
    title: 'Estimating throughput without false precision',
    tags: ['math', 'planning'],
    content: markdown(
      '## Start with a small model',
      String.raw`For independent tasks, expected throughput is $T = \frac{n}{d}$. Treat this as a planning aid.`,
      String.raw`$$
\begin{aligned}
E[X] &= \sum_{i=1}^{n} p_i x_i \\
\operatorname{Var}(X) &= E[X^2] - E[X]^2
\end{aligned}
$$`,
      '| Scenario | Tasks | Days | Tasks/day |\n| :--- | ---: | ---: | ---: |\n| Small batch | 12 | 4 | 3.0 |\n| Larger batch | 18 | 8 | 2.25 |',
      '### A reproducible calculation',
      code(
        'python',
        'samples = [2, 4, 3, 3]\nmean = sum(samples) / len(samples)\nprint(f"Average throughput: {mean:.2f}")',
      ),
      '> Report the assumptions alongside the number.',
    ),
  },
  {
    title: 'Matrices for a tiny recommendation experiment',
    tags: ['math', 'experiments'],
    content: markdown(
      '## Represent interests as vectors',
      String.raw`Let $u = (1, 0, 1)$ describe a member’s interests. A small topic matrix is:`,
      String.raw`$$
A = \begin{bmatrix}
1 & 0 & 1 \\
0 & 1 & 1 \\
1 & 1 & 0
\end{bmatrix}, \qquad s = Au^{\mathsf{T}}
$$`,
      'This fictional experiment ranks three topics. It does not collect personal data.',
      code(
        'python',
        'topics = [[1, 0, 1], [0, 1, 1], [1, 1, 0]]\ninterest = [1, 0, 1]\nscores = [sum(a * b for a, b in zip(row, interest)) for row in topics]\nprint(scores)',
      ),
      '- [x] Compute sample scores\n- [ ] Ask whether the recommendations are useful',
    ),
  },
  {
    title: 'An API notebook: request, inspect, explain',
    tags: ['api', 'tutorial'],
    content: markdown(
      '## Inspect before integrating',
      code('bash', 'curl --fail http://localhost:3000/health'),
      '### A typed boundary',
      code(
        'ts',
        'type Page<T> = { items: T[]; total: number };\nfunction hasResults<T>(page: Page<T>): boolean {\n  return page.items.length > 0;\n}',
      ),
      '### Configuration sketch',
      code(
        'json',
        '{\n  "baseUrl": "http://localhost:3000",\n  "pageSize": 20,\n  "features": ["news", "forum"]\n}',
      ),
      'Keep `pageSize` separate from the total result count. Never paste real access tokens into a shared notebook.',
    ),
  },
  {
    title: 'A remote workshop that leaves useful artifacts',
    tags: ['collaboration', 'events'],
    content: markdown(
      '## Design the output first',
      `[![Workshop layout](${images.workshop} "View the workshop layout")](${images.workshop})`,
      '1. Write one question before the session.\n2. Reserve ten minutes for quiet notes.\n3. Close with a concrete artifact.',
      '> A screenshot, short table, or runnable example can preserve the lesson.',
      '| Artifact | Best for |\n| --- | --- |\n| Decision note | Tradeoffs |\n| Code sample | Reproduction |\n| Checklist | Repeatable steps |',
      '- [x] Share the agenda\n- [ ] Publish the notes',
    ),
  },
  {
    title: 'Chart literacy: averages, spread, and outliers',
    tags: ['metrics', 'math'],
    content: markdown(
      '## Look beyond the average',
      `![Illustrative bar chart with three series](${images.metrics})`,
      String.raw`The sample standard deviation is $s = \sqrt{\frac{1}{n-1}\sum_{i=1}^{n}(x_i-\bar{x})^2}$.`,
      '| Sample | Value | Note |\n| --- | ---: | --- |\n| A | 8 | Typical |\n| B | 9 | Typical |\n| C | 26 | Investigate |',
      '~~Delete every outlier~~ Explain unusual observations before deciding how to summarize them.',
    ),
  },
  {
    title: 'Markdown edge cases worth keeping in a notebook',
    tags: ['gfm', 'reference'],
    content: markdown(
      '## Pipes, links, and literal markup',
      '| Input | Meaning |\n| :--- | :--- |\n| `a\\|b` | A pipe inside inline code |\n| left \\| right | An escaped table separator |',
      'Use a [reference link][spec] more than once: [GFM][spec]. Bare links also work: https://github.github.com/gfm/.',
      code(
        'txt',
        '# This stays code\n- [x] This stays code too\n$not_a_formula$\n<script>This is inert code</script>',
      ),
      'A longer fence can contain a shorter one:',
      '````txt\n```ts\nconst greeting = "hello";\n```\n````',
      '[spec]: https://github.github.com/gfm/ "GFM specification"',
    ),
  },
  {
    title: 'A short note on welcoming new teammates',
    tags: [],
    content: markdown(
      '## Leave room for a first question',
      'A short, friendly reply can make the next question easier. 👋',
      '> Point to a useful example, explain unfamiliar terms, and invite a follow-up.',
      'Thanks to everyone who makes onboarding kinder.',
    ),
  },
];

export const forumContent = [
  {
    title: 'Introduce yourself: what are you working on?',
    content: markdown(
      '## Welcome to Orbit 👋',
      'Share your name, time zone, and one thing you would like to learn.',
      '- What are you building?\n- Which team can you help?\n- What is your favorite tiny productivity trick?',
      `![Our shared orbit](${images.orbit})`,
    ),
  },
  {
    title: 'RFC: how should we write release notes?',
    content: markdown(
      '## Proposed template',
      'Use **result**, **impact**, and **next action**.',
      table,
      '- [x] Draft the template\n- [ ] Try it for two releases',
      '> What would you simplify?',
    ),
  },
  {
    title: 'Help checking the throughput formula',
    content: markdown(
      '## Is this interpretation useful?',
      String.raw`I am using $T = \frac{n}{d}$ for a small planning exercise.`,
      String.raw`$$
T = \frac{18}{8} = 2.25
$$`,
      'How would you communicate uncertainty without making the update too long?',
    ),
  },
  {
    title: 'Share a small TypeScript helper',
    content: markdown(
      '## A helper for tag input',
      code(
        'ts',
        "const tags = 'team, docs, team'\n  .split(',')\n  .map((tag) => tag.trim())\n  .filter(Boolean);\nconsole.log([...new Set(tags)]);",
      ),
      'What should happen with case differences such as `Docs` and `docs`?',
    ),
  },
  {
    title: 'Workshop ideas for next month',
    content: markdown(
      '## Pick a format',
      `![Workshop illustration](${images.workshop})`,
      '| Idea | Length |\n| --- | ---: |\n| API clinic | 45 minutes |\n| Design review | 30 minutes |\n| Pairing hour | 60 minutes |',
      'Reply with an idea and the artifact participants would take away.',
    ),
  },
  {
    title: 'GFM playground: tables and literal pipes',
    content: markdown(
      '## Table examples',
      '| Name | Center | Amount |\n| :--- | :---: | ---: |\n| left \\| right | yes | 12 |\n| `x\\|y` | no | 7 |',
      '~~Old proposal~~ **Current proposal:** keep examples small.',
      'Reference: https://github.github.com/gfm/',
    ),
  },
  {
    title: 'What makes a chart easy to understand?',
    content: markdown(
      '## Before we add another chart',
      `![Sample metrics illustration](${images.metrics})`,
      '1. Write the question.\n2. Label the axes.\n3. Explain the sample size.',
      String.raw`Should we show $\bar{x}$ and the median together?`,
    ),
  },
  {
    title: 'Local setup notes for first-time contributors',
    content: markdown(
      '## My quick check',
      code(
        'bash',
        'node --version\nnpm --version\ncurl --fail http://localhost:3000/health',
      ),
      '- [x] Install dependencies\n- [x] Start the API\n- [ ] Sign in and publish a test post',
      'What step needs a clearer explanation?',
    ),
  },
  {
    title: 'Accessibility review: image descriptions',
    content: markdown(
      '## Describe the useful information',
      'Compare “image” with “Three bars showing rising weekly participation.”',
      `[![Three bars showing rising weekly participation](${images.metrics})](${images.metrics})`,
      '> Alt text should explain why the image matters in this conversation.',
    ),
  },
  {
    title: 'Coffee chat: share one small win',
    content: markdown(
      '## A low-pressure Friday thread',
      'One sentence is enough. Small wins count. ☕',
      'Mine: I asked a question before spending an hour guessing.',
    ),
  },
];

// Each thread gets two top-level comments and a reply to the first comment.
export const commentContent = [
  [
    'Hello from Shanghai! I work on **platform tooling** and would love to learn more about accessible design.',
    'Hi from Lisbon 👋 I can help with documentation reviews and onboarding.',
    '> Welcome!\n\nThe [news page](/news) has a short tour of the workspace.',
  ],
  [
    'I would keep the opening to one sentence and move the rollout detail below a heading.',
    '- [x] Result\n- [x] Impact\n- [ ] Owner of the follow-up',
    'Agreed. ~~A paragraph of background first~~ Start with the result.',
  ],
  [
    String.raw`Yes: $18/8 = 2.25$ tasks per day. State that the workload is assumed to be comparable.`,
    '| Estimate | Tasks/day |\n| --- | ---: |\n| Conservative | 1.5 |\n| Typical | 2.25 |\n| Optimistic | 3.0 |',
    String.raw`A range helps. I would also show the sample mean $\bar{x} = \frac{1}{n}\sum_i x_i$.`,
  ],
  [
    markdown(
      'I normalize before deduplicating:',
      code(
        'ts',
        'const normalize = (tag: string) => tag.trim().toLowerCase();',
      ),
    ),
    'Keep the original spelling for display if capitalization carries meaning.',
    'Good point. I will document the normalization rule next to the input.',
  ],
  [
    'A pairing session could leave participants with a runnable example.',
    `![A possible workshop layout](${images.workshop} "Workshop layout")`,
    '- [x] Choose one problem\n- [ ] Find a co-host',
  ],
  [
    'The escaped pipe works: `left | right` outside a table stays inline code.',
    'Autolinks are useful too: https://github.github.com/gfm/.',
    'And the table alignment should remain visible on a narrow screen.',
  ],
  [
    String.raw`I would include both. For skewed data, $\operatorname{median}(X)$ can be easier to interpret.`,
    '> Label the axes.\n\nThis is the first thing I check in every chart review.',
    'I will add the sample size and a brief description below the image.',
  ],
  [
    markdown('The health check helped:', code('json', '{ "status": "ok" }')),
    'Please include the three seed usernames in the setup guide.',
    'Added to my notes: `superadmin`, `admin`, and `member` use the demo password.',
  ],
  [
    'The longer description tells me what trend the chart is meant to show.',
    'Decorative cover images can have empty alt text; meaningful inline images need a description.',
    'Thanks! I will keep the caption and alt text focused on the same question.',
  ],
  [
    'My small win: a teammate reproduced a bug from my first report. 🎉',
    'I finally replaced a mysterious variable name with one that explains its purpose.',
    'Clear reports save so much time. Thanks for sharing!',
  ],
];
