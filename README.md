<img src="docs/assets/teamorbit.svg" alt="teamorbit logo" width="64" height="64" />

# teamorbit

teamorbit manages team members, events, announcements, Markdown news and blog
posts, a discussion forum, uploads, and live notifications for teams of about
100 members.

It includes a NestJS API, a React test console, and a typed TypeScript client
for building your own frontend.

## Quick start

**Prerequisites:** Node.js 22.12+ and npm.

```bash
# API
cd api
cp .env.example .env
# Configure DATABASE_URL, JWT_SECRET, PUBLIC_BASE_URL and BOOTSTRAP_ADMIN_*.
npm install
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed  # configure BOOTSTRAP_ADMIN_* in .env first
npm run start:dev

# Web (separate terminal, from the repository root)
npm --prefix packages/client install
npm --prefix packages/client run build
cd web
cp .env.example .env.local  # set API_PROXY_TARGET to your API address
npm install
npm run dev
```

| Service | URL |
|---------|-----|
| Web UI | http://localhost:5173 |
| API | http://localhost:3000/api |
| Swagger | http://localhost:3000/docs |
| Health | http://localhost:3000/api/health |
| Metrics | http://localhost:3000/metrics |

### First administrator

Set `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_NAME`, and
`BOOTSTRAP_ADMIN_PASSWORD` in `api/.env`, then run `npm run prisma:seed` from
`api/`. `BOOTSTRAP_ADMIN_EMAIL` is optional. This creates one active superuser
using your supplied credentials; rerunning preserves an existing administrator.
If no bootstrap settings are supplied and an active superuser already exists,
seeding skips without changing any accounts. `npx prisma db seed` and
`npm run prisma:seed` use the same configuration in `api/prisma.config.ts`.
There are no built-in login credentials or sample content in normal seeding.

Sign in with username and password. Email login is also available when an email
has been added. Self-registration requires username, full name, and password;
new accounts remain pending until an administrator activates them.

### Optional test fixtures

A rich mock dataset is available only through the explicit
`demo:seed` command. It lives under [test fixtures](api/test/fixtures/demo/README.md),
is excluded from the application build, and refuses production execution.
Demo illustrations are ordinary uploaded files when explicitly seeded; the API
has no built-in `/demo` route.

Markdown previews also render LaTeX math through KaTeX, an extension beyond GFM.
Use source mode to author `$E = mc^2$` inline, or put `$$` on its own lines
around a display equation. Fractions, sums, aligned equations, and matrices are
included in the sample posts. Code blocks remain literal. Invalid formulas stay
readable; raw HTML is not executed and trusted KaTeX HTML commands are disabled.
The rich text editor does not provide a visual equation editor; keep formula
drafts in source mode while authoring and publishing.

Registration requires username, full name, and password; email is optional.
Self-registered accounts start as `PENDING` until an admin activates them.
Members can add or remove email from Settings; username login remains available.

### Roles and content editing

- **Users:** admins can promote USER to ADMIN; superusers can assign every role.
  Open web sessions refresh permissions within 30 seconds while active or on tab focus.
- **Editors:** `/news/new` (Admin+), `/blog/new`, and `/forum/new` provide dedicated
  creation pages with an MDXEditor toolbar, Markdown source mode, and preview.
  Any member can publish blog posts and global events; news and announcements
  stay Admin+.
- **Images:** paste image files into rich text mode or use the image toolbar
  button. Comments and replies support the same editor inline. Each upload is
  limited to 5 MB; the API stores files on disk and URLs in Markdown.
- **Avatars:** Settings provides five bird portraits in a shared quirky fantasy
  style, image uploads, direct HTTP/HTTPS image links, and **Use default avatar**
  reset. Pick a portrait or apply an image link, then save the profile.
  Administrators can also use **Edit avatar** on each member in
  Users, or choose an avatar when creating an account. Existing moderation rules
  still apply. Saving waits for uploads to finish.
- **Default avatar:** users without a custom image receive the bundled animal
  portrait from `/avatars/default-raven.png`. API responses include absolute
  avatar URLs for profiles and forum authors, using the required `PUBLIC_BASE_URL`. Send `avatarUrl: null` to restore the default;
  existing custom avatars are preserved. Broken custom images fall back to the
  default in the web console.
- **Upload cleanup:** hourly orphan cleanup with a 24-hour grace period protects shared
  images in saved content. Admins can preview and run cleanup in **Upload maintenance**.
  See the [cleanup guide](docs/usage.md#upload-cleanup) for configuration and draft limitations.
- **Avatar catalogue:** public `GET /api/avatars` (SDK: `orbit.avatars.list()`) returns
  preset IDs, names, absolute image URLs, and the default marker. Presets are
  bundled product assets and work without demo seeding. Save a preset's `url`
  through the existing `avatarUrl` profile field, just like an uploaded or
  externally hosted image.

This project is pre-release: no compatibility aliases or legacy seed repairs are maintained. See the [usage guide](docs/usage.md) for explicit development database reset and verification commands.

## TypeScript client

```ts
import { createTeamOrbitClient } from '@goatcheese/teamorbit-client';

const orbit = createTeamOrbitClient({ baseUrl: 'https://orbit.example.com' });
await orbit.auth.login('your-username', 'your-password');
const { items } = await orbit.news.list();
```

See the [client guide](packages/client/README.md) for email login, optional-email
registration, nullable user emails, uploads, and generated request/response types.

## Repository layout

```text
teamorbit/
├── api/              NestJS API (Prisma, SQLite, JWT, Socket.io)
├── web/              React test console and browser tests
├── packages/client/  Typed TypeScript API client
├── openapi/          Generated API contract
├── docs/             Architecture, schema, features, and usage
├── ecosystem.config.cjs  PM2 production process file
└── scripts/          SDK checks and production deploy helper
```

## Documentation

- [Architecture](docs/architecture.md) — modules, data flow, auth, and uploads
- [Schema](docs/schema.md) — database models and relationships
- [Features](docs/features.md) — capabilities, permissions, and API surface
- [Usage](docs/usage.md) — setup, account flows, editors, tests, upgrades, and PM2 deploy
- [Web console](web/README.md) — frontend setup and browser checks
- [Client SDK](packages/client/README.md) — TypeScript integration

## Tech stack

| Layer | Choice |
|-------|--------|
| API | NestJS |
| DB | SQLite + Prisma |
| Auth | JWT + RBAC |
| Realtime | Socket.io |
| Uploads | Local disk (Multer) |
| Logs | Pino |
| API docs | Swagger / OpenAPI |
| Metrics | Prometheus (`/metrics`) |
| Web | Vite, React, TanStack Router/Query, shadcn/ui, MDXEditor |
| Client | TypeScript + openapi-fetch |
| Tests | Jest (API), Playwright (web), Node test runner (client) |
| Process manager | PM2 (`ecosystem.config.cjs`, `scripts/deploy-prod.sh`) |

## License

See [LICENSE](LICENSE).
