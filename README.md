<div align="center">

<img src="docs/assets/teamorbit.svg" alt="teamorbit logo" width="96" height="96" />

# teamorbit

**A self-hosted collaboration backend for small teams: members, events, news, a forum, and live notifications.**

[![Checks](https://img.shields.io/github/actions/workflow/status/cyborgoat/teamorbit/checks.yml?style=flat-square&label=checks)](https://github.com/cyborgoat/teamorbit/actions/workflows/checks.yml)
[![License: MIT](https://img.shields.io/github/license/cyborgoat/teamorbit?style=flat-square)](LICENSE)
![NestJS](https://img.shields.io/badge/API-NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-typed%20client-3178C6?style=flat-square&logo=typescript&logoColor=white)

[Quick start](#quick-start) ·
[Features](#features) ·
[TypeScript client](#typescript-client) ·
[Documentation](#documentation)

</div>

---

## What is teamorbit?

teamorbit is the backend a team of up to about 100 people needs to stay in sync:
accounts and roles, announcements, events, Markdown news and blog posts, a
discussion forum, image uploads, and real-time notifications.

It ships as three parts you can use together or separately:

- a **NestJS API** with SQLite, JWT authentication, and role-based access,
- a **React test console** that exercises every feature,
- a **typed TypeScript client** for building your own frontend.

teamorbit is pre-release. No compatibility aliases or legacy seed repairs are
maintained, so expect the API to evolve.

## Features

- **Members and roles.** `SUPERUSER`, `ADMIN`, and `USER` roles, account
  lifecycle statuses, self-registration with admin activation, optional email, and
  avatars (presets, upload, or link).
- **Announcements and events.** Team notices, plus scheduled events that are
  global or invite-only.
- **News and blog.** Markdown articles with tags, cover images, and view counts.
  Admins publish news; any member can blog.
- **Forum.** Markdown posts with up and down votes and moderation by authors and
  admins.
- **Comments everywhere.** Threaded comments with votes on every content type.
- **Live notifications.** Socket.io toasts, plus REST endpoints for read, unread,
  dismiss, and restore.
- **Uploads.** Authenticated image uploads that return a public URL for covers,
  avatars, and Markdown embeds.
- **Observability.** Structured Pino logs with request IDs and Prometheus metrics
  at `/metrics`.
- **Contract-first.** Swagger UI and a generated OpenAPI document keep the API and
  the client in sync.

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

Sign in with the administrator you configured in `BOOTSTRAP_ADMIN_*`. Account
flows, roles, editors, avatars, and upload cleanup are covered in the
[usage guide](docs/usage.md) and [features](docs/features.md).

Want richer sample data? The optional [demo seed](api/test/fixtures/demo/README.md)
is not part of normal seeding and refuses to run in production.

## TypeScript client

```ts
import { createTeamOrbitClient } from '@goatcheese/teamorbit-client';

const orbit = createTeamOrbitClient({ baseUrl: 'https://orbit.example.com' });
await orbit.auth.login('your-username', 'your-password');
const { items } = await orbit.news.list();
```

The client is generated from the OpenAPI contract, so requests and responses are
fully typed. See the [client guide](packages/client/README.md) for integration
details.

## Documentation

- [Architecture](docs/architecture.md): modules, data flow, auth, and uploads
- [Schema](docs/schema.md): database models and relationships (Prisma is the source of truth)
- [Features](docs/features.md): capabilities and permissions
- [Usage](docs/usage.md): setup, account flows, editors, tests, upgrades, PM2
- [Web console](web/README.md): frontend setup and browser checks
- [Client SDK](packages/client/README.md): TypeScript integration
- [OpenAPI](openapi/openapi.json): the HTTP contract

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

## Tech stack

| Layer | Choice |
|-------|--------|
| API | NestJS |
| Database | SQLite + Prisma |
| Auth | JWT + role-based access control |
| Realtime | Socket.io |
| Uploads | Local disk (Multer) |
| Logs and metrics | Pino, Prometheus (`/metrics`) |
| API docs | Swagger / OpenAPI |
| Web | Vite, React, TanStack Router/Query, shadcn/ui, MDXEditor |
| Client | TypeScript + openapi-fetch |
| Tests | Jest (API), Playwright (web), Node test runner (client) |
| Deployment | PM2 (`ecosystem.config.cjs`, `scripts/deploy-prod.sh`) |

## Contributing

Issues and pull requests are welcome. CI runs on every push and pull request; see
the [usage guide](docs/usage.md) for how to run the API, browser, and client
tests locally.

## License

MIT. See [LICENSE](LICENSE).
