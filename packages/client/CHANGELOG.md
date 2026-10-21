# Changelog

## 0.1.3 — 2026-10-21

- List notifications with `status=unread|read|dismissed`.
- `orbit.notifications.markUnread(id)` and `orbit.notifications.restore(id)`.

## 0.1.2 — 2026-10-21

- Client helpers: `orbit.notifications.markAllRead()` and `orbit.notifications.delete(id)` (per-user dismiss; does not remove shared global rows for others).

## 0.1.1 — 2026-10-21

- Notification list items include `audience` (`GLOBAL` | `DIRECTED`) for targeted vs broadcast notifications.

## 0.1.0 — 2026-10-16

Initial release of the typed teamorbit REST client.

- Typed resource helpers and generated OpenAPI request/response types for `/api` endpoints.
- Username or email login, optional account email, profile updates, and user administration.
- Events, announcements, news, blog posts, forum discussions, comments, and voting.
- Paginated list helpers and async iteration over supported collections.
- Image uploads with absolute public URLs and a public avatar preset catalogue.
- Notification list/read helpers and consistent API error handling.
- Custom fetch and token providers, with cancellation support for profile and CRUD list reads.

Use this release with the matching teamorbit API. Realtime notifications use
Socket.IO separately from this REST client.
