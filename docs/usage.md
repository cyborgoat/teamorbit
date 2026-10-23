# Usage

## Fresh setup

Use Node.js 22.12+ and npm. From the repository root:

```bash
npm --prefix api ci
npm --prefix api run prisma:generate
cp api/.env.example api/.env
# Set DATABASE_URL, JWT_SECRET, PUBLIC_BASE_URL and BOOTSTRAP_ADMIN_* in api/.env.
cd api
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

In a separate terminal, from the repository root:

```bash
npm --prefix packages/client ci
npm --prefix packages/client run build
npm --prefix web ci
cp web/.env.example web/.env.local
# Set API_PROXY_TARGET to the API service origin.
npm --prefix web run dev
```

`PUBLIC_BASE_URL` is the API origin reachable by all consuming applications, such as `http://localhost:3000` on the same computer or a deployed HTTPS origin. It is required; there is no inferred request-host fallback. Other devices need a reachable host instead of localhost.

Web: `http://localhost:5173`; API: `http://localhost:3000/api`; Swagger: `http://localhost:3000/docs`; health: `/api/health`; metrics: `/metrics`.

## Production with PM2

Install PM2 once (`npm install -g pm2`). Configure `api/.env` for production:
set a strong `JWT_SECRET`, a reachable `PUBLIC_BASE_URL` (the origin browsers use),
and your bootstrap admin values before the first seed if needed.

From the repository root:

```bash
./scripts/deploy-prod.sh
```

This builds the client, API, and web console, runs `prisma migrate deploy`, then
starts or reloads both processes from [`ecosystem.config.cjs`](../ecosystem.config.cjs).

| Process | Role | Default URL |
|---------|------|-------------|
| `teamorbit-api` | NestJS API (`node dist/main.js`) | `http://127.0.0.1:3000` |
| `teamorbit-web` | Vite preview of `web/dist` with API proxy | `http://127.0.0.1:4173` |

SQLite and local uploads require a single API instance; the ecosystem file uses
fork mode with `instances: 1`. Override the web→API proxy with
`API_PROXY_TARGET` when starting PM2 if the API is not on `127.0.0.1:3000`.

Useful commands:

```bash
pm2 status
pm2 logs
pm2 reload ecosystem.config.cjs --update-env
pm2 stop ecosystem.config.cjs
```

Put a reverse proxy (TLS) in front of the web port for public access, or point
it at the API and serve `web/dist` yourself. Keep `PUBLIC_BASE_URL` aligned with
the public origin so absolute upload and avatar URLs stay reachable.

## Development data

Normal seeding creates one active superuser from `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_NAME`, and `BOOTSTRAP_ADMIN_PASSWORD`; email is optional. Credentials are never supplied by the application. Repeating bootstrap does not change an existing administrator.

Rich Markdown fixtures are explicitly opt-in, from `api/`:

```bash
NODE_ENV=development npm run demo:seed
```

The command requires `PUBLIC_BASE_URL`, refuses production execution, and copies fixture illustrations to the upload directory. No demo content is loaded on application startup.

To deliberately recreate a disposable development database after schema changes, stop the API and run from `api/`:

```bash
npx prisma migrate reset --force --skip-seed
npm run prisma:seed
# Optional: NODE_ENV=development npm run demo:seed
```

The reset deletes the configured database's records. Do not use it on a database whose contents you need. No automatic data reset or legacy conversion is provided.

## Accounts and media

Sign in with username/password, or select email login when an address is attached. Self-registration creates a pending account. Administrators activate it in Users. Members edit profile, optional email, password, and avatar in Settings.

Avatars support eight animal and fantasy creature presets (two birds), uploads, an external HTTP(S) image URL, and default reset. `avatarUrl: null` restores the default raven; responses contain its absolute effective URL. Covers can likewise be removed using `null`.

Upload images through `POST /api/uploads`, authenticated, with multipart field `file` (maximum 5 MB). Use the absolute returned `url` for Markdown. Generated URLs use `PUBLIC_BASE_URL`; external images remain external.

News/blog/forum editors support source mode, rich-text image paste, and previews. Read-only rendering follows GFM with an explicit KaTeX math extension. Keep formula drafts in source mode. Code fences remain literal; HTML is not executed.

## Verification

```bash
npm --prefix api run lint
npm --prefix api test -- --runInBand
npm --prefix api run test:seed
npm --prefix api run test:e2e -- --runInBand
npm --prefix packages/client test
npm --prefix web run lint
npm --prefix web run build
npm --prefix web exec playwright install chromium
npm --prefix web run test:e2e
npm --prefix web run test:integration
```

API tests and real-browser tests create disposable databases and uploads. They do not use your development database. Set `PLAYWRIGHT_CHROME=1` to use an installed Chrome. The real-browser suite reserves ports 3099 and 5189.

After API changes, export OpenAPI from `api/` using `npm run openapi:export`, then rebuild the client. `scripts/check-sdk.sh` verifies generated-contract consistency in CI. It requires the normal API environment settings but does not connect to the database during export.

## Upload cleanup

Uploaded files are retained while any saved post, announcement, event description,
comment/reply, cover, avatar, or notification references them. A file used by more
than one record is retained until every saved reference is removed. Mentioning a
local upload URL in plain text or code also conservatively retains it.

The API checks hourly by default, starting one hour after startup. An unreferenced
file becomes eligible 24 hours after it is first observed without references.
Reattaching it resets that clock. Existing files, including nested demo assets,
are discovered with a fresh grace period; file age alone never causes immediate
removal. Deleted content is removed immediately, while its orphan assets wait for
cleanup. Only regular files inside `UPLOAD_DIR` are eligible: symlinks, bundled
avatars, branding, and remote files are excluded.

Administrators and superusers can open **Upload maintenance** from the sidebar,
review orphan paths, sizes, eligibility, and errors, then choose **Clean now** and
confirm. Manual runs follow the same grace period and recheck references before
deletion. The page shows run progress and counts; failed deletions are retried on
the next scheduled or manual run. Cleanup runs do not overlap, including across
API processes sharing the database and upload filesystem. Interrupted claims
resume on the next run; leases expire after five minutes without progress.

Configure these settings in `api/.env`, then restart the API:

| Setting | Default | Accepted values |
|---------|---------|-----------------|
| `UPLOAD_CLEANUP_ENABLED` | `true` | `true` or `false`; disables only scheduled runs |
| `UPLOAD_CLEANUP_INTERVAL_HOURS` | `1` | Number from 1 to 168 |
| `UPLOAD_CLEANUP_GRACE_HOURS` | `24` | Number from 1 to 8760 |

After upgrading, run `npx prisma migrate deploy` inside `api/` before starting the
API. New registry tables are populated by the first preview or cleanup run. Back
up the database and upload directory together before the first cleanup; restore
both together if recovery is needed. Set `UPLOAD_CLEANUP_ENABLED=false` to review
historical files manually before enabling scheduled cleanup.

Unsaved drafts and URLs used only outside this application cannot be detected and
may be deleted after the grace period. References to local files must use
`/uploads/...` paths or absolute URLs under the configured `PUBLIC_BASE_URL`;
review stored absolute URLs before changing that origin. Saving a reference to an
asset already claimed or deleted returns a conflict; upload the image again.

Admin API / SDK: `GET /api/uploads/cleanup` accepts `page` and `limit` and returns
the preview, totals, settings, and latest run; `POST /api/uploads/cleanup` starts a
run and returns `202 { id }` (`409` when already running). Use
`orbit.uploads.cleanupPreview()` and `orbit.uploads.startCleanup()` in the client.
