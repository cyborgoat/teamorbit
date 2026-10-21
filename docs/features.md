# Features

## Domains

### Users

Manage team members with roles and lifecycle status. Sign in with username and
password by default, or choose email/password when the account has email.
Email is optional for both self-registration and admin-created accounts;
profile settings can add or remove it.

| Field | Notes |
|-------|--------|
| Username, full name, optional email | Unique username; email unique when provided |
| Password | bcrypt-hashed |
| Role | `SUPERUSER`, `ADMIN`, `USER` |
| Status | `ACTIVE`, `INACTIVE`, `PENDING`, `SUSPENDED`, `DELETED` |
| Avatar URL | Five bird presets, custom upload, external HTTP/HTTPS image link, or default reset |

**Ways to add members**

1. **Self-register** (`POST /api/auth/register`) → status `PENDING` (cannot log in until activated).
2. **Admin create** (`POST /api/users`) → typically `ACTIVE` so they can sign in immediately.

**Permissions**

| Action | SUPERUSER | ADMIN | USER |
|--------|-----------|-------|------|
| Login (if ACTIVE) | yes | yes | yes |
| Update own profile (name, email, avatar) | yes | yes | yes |
| Change own password | yes | yes | yes |
| List / create / update / soft-delete users | yes | yes* | no |
| Assign SUPERUSER role | yes | no | no |
| Modify another SUPERUSER | yes | no | no |

\*Admins can promote USER to ADMIN, but cannot change existing ADMIN or
SUPERUSER roles or assign SUPERUSER. The Users page exposes permitted role
changes. The API enforces the current saved role on each authenticated HTTP
request; open web sessions refresh their profile every 30 seconds while active
and on tab focus.

Soft delete sets status to `DELETED` rather than removing the row.

### Announcements

Short team notices (`title`, `description`, author). Creating one emits a notification.

### Events

Scheduled items with `startAt`, `endAt`, `location`, and optional `coverImageUrl`. Creating one emits a notification.

### News (markdown)

Articles with markdown `content`, `tags[]`, and optional cover. Creating one emits a notification.

### Blog posts (markdown)

Same content model as news, kept as a separate resource for clearer product and API testing.

### Forum

Team discussion board with markdown posts and comments.

| Capability | Notes |
|------------|--------|
| Posts | Any authenticated user; markdown body; images via absolute upload URLs |
| Comments | Top-level + one-level replies |
| Votes | Up/down (or clear) on posts and comments; one vote per user |
| Moderation | Authors edit/delete their own; Admin/Superuser can moderate any |
| Notifications | Global on new post; directed to post/parent author on new comment |

### Uploads

Authenticated image upload; returns an absolute public URL like `https://orbit.example/uploads/<uuid>.jpg` for use as covers, avatars, or markdown embeds.

### Notifications

- **Global** (`audience: GLOBAL`): announcements, events, news, blog posts, forum posts — visible to all users
- **Directed** (`audience: DIRECTED`): forum comments — top-level notifies the post author; replies notify the parent comment author (self-notifications are skipped)
- Live toast via Socket.io `notification:new` (global to all authenticated sockets; directed to recipient user rooms)
- List, mark-read, mark-all-read, and per-user dismiss over REST (list excludes notifications the caller dismissed; dismiss does not delete the shared row for others)

## HTTP API (summary)

All content and user routes (except register/login) require a Bearer JWT unless noted.

| Area | Methods | Path prefix |
|------|---------|-------------|
| Auth | POST register/login, GET/PATCH me, POST change-password | `/api/auth` |
| Users | GET/POST/PATCH/DELETE | `/api/users` |
| Announcements | GET/POST/PATCH/DELETE | `/api/announcements` |
| Events | GET/POST/PATCH/DELETE | `/api/events` |
| News | GET/POST/PATCH/DELETE | `/api/news` |
| Blog | GET/POST/PATCH/DELETE | `/api/blog-posts` |
| Forum | GET/POST/PATCH/DELETE posts & comments, PUT votes | `/api/forum-posts`, `/api/forum-comments` |
| Uploads | POST | `/api/uploads` |
| Notifications | GET list, POST `read-all`, POST `:id/read`, DELETE `:id` | `/api/notifications` |
| Health | GET | `/api/health` |
| Metrics | GET | `/metrics` |
| Swagger | UI | `/docs` |

List endpoints support pagination (`page`, `limit`) and simple filters (`q`, `tag`, `status` where applicable).

Interactive OpenAPI docs: http://localhost:3000/docs

## Test UI features (`web/`)

| Page | Purpose |
|------|---------|
| `/login` | Username/password; optional email login mode |
| `/register` | Self-signup with optional email (PENDING) |
| `/` | Home shortcuts (authenticated) |
| `/announcements` | List + create dialog |
| `/events` | List + create with datetime-local + cover |
| `/news` | News list, previews, and permitted deletion |
| `/news/new` | Dedicated news creation page (Admin+) |
| `/blog` | Blog list, previews, and permitted deletion |
| `/blog/new` | Dedicated blog creation page (Admin+) |
| `/forum` | Forum list |
| `/forum/new` | Dedicated forum creation page |
| `/forum/$postId` | Post detail, comments, votes |
| `/users` | Create user (Admin+), status and permitted role changes |
| `/settings` | Self-service profile + change password |
| `/notifications` | Inbox + mark read + live toasts |
| `/uploads` | Standalone image upload check |

All Markdown creation fields use MDXEditor with a formatting toolbar and source
mode. Paste image files into rich text mode or use the image toolbar button
(maximum 5 MB each). News, blog, and forum creation pages include an inline
preview; comments and replies remain inline. Drafts are held in page memory.

## Observability

- **Pino** structured HTTP logs with request IDs
- **Prometheus** default metrics at `/metrics`
- Alertmanager is optional ops config (scrape failure / API down), not an in-app feature
