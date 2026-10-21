# teamorbit API

NestJS service with Prisma/SQLite, JWT authentication, local image uploads, and Socket.IO notifications.

Follow the [setup and verification guide](../docs/usage.md). Configure `.env` before starting: `DATABASE_URL`, `JWT_SECRET`, and `PUBLIC_BASE_URL` are required. Normal seeding creates only your explicitly configured administrator.

From this directory:

```bash
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

JSON endpoints use `/api`, Swagger uses `/docs`, and public image files use `/uploads` and `/avatars`. The API returns absolute public image URLs using `PUBLIC_BASE_URL`.

```bash
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:seed
npm run build
```

Integration tests use a temporary database and upload directory. Optional demo data is available through `NODE_ENV=development npm run demo:seed`; it is excluded from runtime builds. See the [architecture](../docs/architecture.md), [schema](../docs/schema.md), and [fixture guide](test/fixtures/demo/README.md).
