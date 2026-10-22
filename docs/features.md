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

Short team notices (`title`, `description`, author). Creating one emits a notification. Admins create; authors and admins can edit/delete. Regular members cannot publish announcements.

### Events

Scheduled items with `startAt`, `endAt`, `location`, optional `coverImageUrl`, and audience:

| Audience | Visibility | Create notification |
|----------|------------|---------------------|
| `GLOBAL` (default) | All authenticated users | Global |
| `INVITE_ONLY` | Chosen invitees only (creator always included) | Directed to invitees |

Any signed-in member can create global events; authors and admins can edit/delete. Invite-only events are Admin+ in the console (member directory is admin-gated). List and detail respect audience (non-invitees get a 404 for invite-only events).

### News (markdown)

Articles with markdown `content`, `tags[]`, optional cover, and a `viewCount` incremented on each detail GET. Admins create; authors and admins can edit/delete. Creating one emits a notification.

### Blog posts (markdown)

Same content model as news. Any signed-in member can publish; authors and admins can edit/delete.

### Forum

Team discussion board with markdown posts (and post-level votes).

| Capability | Notes |
|------------|--------|
| Posts | Any authenticated user; markdown body; images via absolute upload URLs |
| Views | `viewCount` increments on each post detail GET |
| Post votes | Up/down (or clear); one vote per user per post |
| Moderation | Authors edit/delete their own; Admin/Superuser can moderate any |
| Notifications | Global on new post |

### Comments (all content)

Shared markdown comments on announcements, events, news, blog posts, and forum posts.

| Capability | Notes |
|------------|--------|
| Nesting | Top-level + one-level replies |
| Votes | Up/down (or clear) on comments; one vote per user |
| Moderation | Authors edit/delete their own; Admin/Superuser can moderate any |
| Notifications | Directed to content author (top-level) or parent author (reply); self skipped |
| API | `/api/comments` with `resourceType` + `resourceId` |

### Uploads

Authenticated image upload; returns an absolute public URL like `https://orbit.example/uploads/<uuid>.jpg` for use as covers, avatars, or markdown embeds.

### Notifications

- **Global** (`audience: GLOBAL`): announcements, global events, news, blog posts, forum posts — visible to all users
- **Directed** (`audience: DIRECTED`): invite-only event creates (invitees); comments on any content type — top-level notifies the content author; replies notify the parent comment author (self-notifications are skipped)
- Live toast via Socket.io `notification:new` (global to all authenticated sockets; directed to recipient user rooms)
- List (optional `status=unread|read|dismissed`), mark-read, mark-unread, mark-all-read, per-user dismiss, and restore over REST (dismiss hides for one user only)

## HTTP API (summary)

Endpoint details and schemas: [OpenAPI](../openapi/openapi.json) and the
[client SDK](../packages/client/README.md) are the source of truth. This table
is a short overview only.

All content and user routes (except register/login) require a Bearer JWT unless noted.

| Area | Methods | Path prefix |
|------|---------|-------------|
| Auth | POST register/login, GET/PATCH me, POST change-password | `/api/auth` |
| Users | GET/POST/PATCH/DELETE | `/api/users` |
| Announcements | GET/POST/PATCH/DELETE | `/api/announcements` |
| Events | GET/POST/PATCH/DELETE | `/api/events` |
| News | GET/POST/PATCH/DELETE | `/api/news` |
| Blog | GET/POST/PATCH/DELETE | `/api/blog-posts` |
| Forum | GET/POST/PATCH/DELETE posts, PUT post votes | `/api/forum-posts` |
| Comments | GET/POST/PATCH/DELETE, PUT vote | `/api/comments` |
| Uploads | POST | `/api/uploads` |
| Notifications | GET list (`status`), POST `read-all`, POST/DELETE `:id/read`, POST `:id/restore`, DELETE `:id` | `/api/notifications` |
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
| `/announcements/$id` | Detail, author/admin edit, comments |
| `/events` | List + create (global / invite-only, datetime-local, cover) |
| `/events/$id` | Detail, author/admin edit, audience/invitees, comments |
| `/news` | News list and permitted deletion |
| `/news/new` | Dedicated news creation page (Admin+) |
| `/news/$id` | Detail, author/admin edit, comments |
| `/blog` | Blog list and permitted deletion |
| `/blog/new` | Dedicated blog creation page (any member) |
| `/blog/$id` | Detail, author/admin edit, comments |
| `/forum` | Forum list |
| `/forum/new` | Dedicated forum creation page |
| `/forum/$postId` | Post detail, votes, author/admin edit, comments |
| `/users` | Create user (Admin+), status and permitted role changes |
| `/settings` | Self-service profile + change password |
| `/notifications` | Unread / read / dismissed groups + mark read/unread, dismiss, restore, mark all read |
| `/uploads` | Standalone image upload check |

All Markdown creation fields use MDXEditor with a formatting toolbar and source
mode. Paste image files into rich text mode or use the image toolbar button
(maximum 5 MB each). News, blog, and forum creation pages include an inline
preview; comments and replies remain inline. Drafts are held in page memory.

## Observability

- **Pino** structured HTTP logs with request IDs
- **Prometheus** default metrics at `/metrics`
- Alertmanager is optional ops config (scrape failure / API down), not an in-app feature
