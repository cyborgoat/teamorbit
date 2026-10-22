# Changelog

## 0.2.2 — 2026-10-21

- News, blog posts, and forum posts include `viewCount`, incremented on each detail GET.
- Add admin upload cleanup preview and background cleanup helpers, with typed run summaries.

## 0.2.1 — 2026-10-21

- Events support `audience` (`GLOBAL` | `INVITE_ONLY`) and `recipientIds` / `recipients` for invitees and directed create notifications.

## 0.2.0 — 2026-10-21

- Universal comments: `orbit.comments.{list,create,update,delete,vote}` for any content `resourceType`.
- Removed forum-scoped comment helpers (`orbit.forum.addComment` / `voteComment` / …); forum posts still use `orbit.forum.*`.

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
