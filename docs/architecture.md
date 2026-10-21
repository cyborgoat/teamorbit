# Architecture

teamorbit is a NestJS API, a React administration console, and a typed client package for teams of about 100 members. Prisma and SQLite provide persistence; images are stored on local disk.

## Boundaries

- JSON endpoints live under `/api`; Swagger lives at `/docs`. Public image files live under `/uploads` and `/avatars`. Socket.IO uses `/socket.io`.
- Development Vite proxies those four prefixes using `API_PROXY_TARGET`; frontend route navigation never overlaps API routes.
- Configuration is validated before startup. `DATABASE_URL`, `JWT_SECRET`, and an HTTP(S) origin in `PUBLIC_BASE_URL` are required. `UPLOAD_DIR` is resolved once, and `PORT` must be valid.
- Domain modules retain separate announcements, events, news, blog, forum, users, and notification resources. Comments are a shared module keyed by `resourceType` + `resourceId`. News and blog CRUD share `ArticleService`. Events support `GLOBAL` / `SELECTED` audience with `EventRecipient` invitees. Shared helpers handle user selections, response presentation, media validation, tags, pagination, and create-notification payloads.

## Data and contracts

`api/prisma/schema.prisma` defines storage. API DTOs define public request and response contracts; `openapi/openapi.json` and the client types are generated from them. The web imports that client rather than implementing another HTTP layer.

News and blog relate to unique `Tag` records. Tags are trimmed, deduplicated arrays in JSON responses, with exact-name filtering. All DELETE endpoints return `{ ok: true }`; user deletion changes status to `DELETED`.

Service-owned avatar and cover fields store media paths; external HTTP(S) images retain their URLs. Explicit response presenters return absolute image URLs. Upload responses are absolute URLs, which editors embed verbatim into Markdown. Markdown source is never rewritten during reads. Preset avatars are bundled product assets, independent of demo seeding.

## Authentication

HTTP JWT validation and WebSocket handshakes share the current active-account lookup. Roles are read from the database. New registrations remain pending until activated. Socket connections are checked for expiration and account revocation every second, and again before notification delivery.

The web keeps its bearer token in localStorage. A shared authenticated route layout protects member screens. Profile refresh occurs every 30 seconds and on window focus. Session changes clear protected query data; loss of administrator permissions removes cached member-management data. Logout disconnects the notification socket.

## Transactions

Content and its notification are inserted in one database transaction. Global notifications have no recipient rows; directed ones store `NotificationRecipient` rows and are listed/emitted only for those users. Broadcasting happens after commit and is best effort. REST notification reads recover persisted entries after reconnect. Vote lookup, vote mutation, cached score adjustment, and the returned score share a transaction. News, blog, and forum detail GETs increment `viewCount` via `updateMany` so `@updatedAt` stays unchanged.

## Web and Markdown

TanStack Router handles navigation and TanStack Query handles server state with shared query keys. News and blog share a list/preview component. Lists expose pagination and retry states. Forum presentation is divided into post, comment, composer, and vote components.

All read-only content uses the same GFM renderer, with KaTeX as an explicit math extension. HTML execution and trusted KaTeX commands are disabled. MDXEditor provides rich-text and source editing with a shared upload helper, a 5 MB limit, and submission blocking during uploads.

## Tests and fixtures

Normal seeding creates only an explicitly configured administrator. Optional rich demo fixtures live under `api/test/fixtures/demo`, outside the application build. No legacy seed repair paths are shipped.

API integration tests use temporary databases and upload directories. Mocked browser tests exercise UI behavior, while a separate real-server browser suite verifies upload, publish, image rendering, avatar presets, and direct image access from another browser context.
