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

Bootstrap an administrator, account flows, roles, editors, avatars, and upload
cleanup are documented in the [usage guide](docs/usage.md) and
[features](docs/features.md). Product capabilities and permissions live in
features; HTTP details come from [OpenAPI](openapi/openapi.json) and the
[client SDK](packages/client/README.md).

Optional rich fixtures: [demo seed](api/test/fixtures/demo/README.md) (not part
of normal seeding; refuses production).

This project is pre-release: no compatibility aliases or legacy seed repairs are
maintained.

## TypeScript client

```ts
import { createTeamOrbitClient } from '@goatcheese/teamorbit-client';

const orbit = createTeamOrbitClient({ baseUrl: 'https://orbit.example.com' });
await orbit.auth.login('your-username', 'your-password');
const { items } = await orbit.news.list();
```

See the [client guide](packages/client/README.md) for integration details and
generated request/response types.

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
- [Schema](docs/schema.md) — database models and relationships (Prisma is SoT)
- [Features](docs/features.md) — capabilities and permissions
- [Usage](docs/usage.md) — setup, account flows, editors, tests, upgrades, PM2
- [Web console](web/README.md) — frontend setup and browser checks
- [Client SDK](packages/client/README.md) — TypeScript integration
- [OpenAPI](openapi/openapi.json) — HTTP contract source of truth

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
