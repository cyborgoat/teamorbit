# @goatcheese/teamorbit-client

Typed TypeScript client for the **teamorbit API**, a team hub with members, events,
announcements, news, blog posts, a forum with comments and votes, and notifications.

- Fully typed requests **and** responses, generated from the API's OpenAPI spec
- Ergonomic helpers (`orbit.news.list()`, `orbit.auth.login()`, ...) on top of [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/), with no codegen step for you
- Works in browsers, Node 18+, Deno, Bun and edge runtimes (anything with `fetch`)
- Handles login, token storage and the `Authorization: Bearer` header for you

> This package is only the client. You need a running teamorbit API
> ([source](https://github.com/cyborgoat/team-orbit)) to call.

## Install

```bash
npm install @goatcheese/teamorbit-client
```

## Quick start

```ts
import { createTeamOrbitClient } from '@goatcheese/teamorbit-client';

const orbit = createTeamOrbitClient({ baseUrl: 'https://orbit.example.com' });

// Log in once: the token is remembered for every later call
await orbit.auth.login('admin', 'password123');

const { items } = await orbit.forum.listPosts({ page: 1, limit: 10, q: 'welcome' });
items[0].commentCount; // number

await orbit.news.create({ title: 'v2 released', content: '## Notes\n...', tags: ['release'] });
await orbit.forum.votePost(items[0].id, 1); // 1 = up, -1 = down, 0 = clear
```

Persisting the token (e.g. across page loads)? Pass `token: () => localStorage.getItem('token') ?? undefined`
instead, or call `orbit.setToken(...)`. A token from `login()` / `setToken()` takes precedence over the option.

## Authentication and optional email

The helper signature is `auth.login(identifier, password, method?)`. Without a
method, identifiers containing `@` use email login; all others use username.
Pass `'username'` or `'email'` to choose explicitly. The helper sends exactly
one API identifier and remembers the returned access token.

```ts
import type { LoginMethod, User } from '@goatcheese/teamorbit-client';

await orbit.auth.login('member', password);                // username
await orbit.auth.login('member@example.com', password);   // email inferred from the identifier
const method: LoginMethod = 'username';
await orbit.auth.login('name@work', password, method);     // username containing @
await orbit.auth.login('member@example.com', password, 'email');

// Email is optional; the account remains PENDING until an admin activates it.
const registered = await orbit.auth.register({
  username: 'new-member',
  fullName: 'New Member',
  password: 'a-strong-password',
});

const me: User = await orbit.auth.me();
console.log(me.email ?? 'No email supplied');
await orbit.auth.updateMe({ email: 'member@example.com' });
await orbit.auth.updateMe({ email: null }); // removes email login; username still works
```

`register` and `users.create` may omit `email` (or send `null`). User responses
always include `email` as `string | null`; handle `null` in consuming UIs.
Supplied email addresses must be valid and unique. A profile update that omits
email leaves it unchanged; `null` or an empty string removes it.

Raw `POST /api/auth/login` requests use either `{ username, password }` or
`{ email, password }`; both identifiers together, or neither, return 400.
Unknown users and wrong passwords return 401. Self-registration keeps the
existing admin activation requirement.

## Helpers

Every helper returns the parsed response body and **throws** a `TeamOrbitError` on non-2xx.
All params, bodies and responses are typed from the OpenAPI spec.

| Namespace | Methods |
| --- | --- |
| `orbit.auth` | `login(identifier, password, method?)`, `register(body)`, `me()`, `updateMe(body)`, `changePassword(body)`, `logout()` |
| `orbit.users`, `events`, `announcements`, `news`, `blogPosts` | `list(query?)`, `get(id)`, `create(body)`, `update(id, body)`, `delete(id)`, `iterate(query?)` |
| `orbit.forum` | `listPosts`, `getPost`, `createPost`, `updatePost`, `deletePost`, `addComment(postId, body)`, `updateComment`, `deleteComment`, `votePost(id, value)`, `voteComment(id, value)` |
| `orbit.notifications` | `list(query?)`, `markRead(id)`, `markAllRead()`, `delete(id)` |
| `orbit.uploads` | `upload(file, filename?)` |
| `orbit.health()` | |

```ts
import { TeamOrbitError } from '@goatcheese/teamorbit-client';

try {
  await orbit.events.get(id);
} catch (e) {
  if (e instanceof TeamOrbitError && e.status === 404) console.log('no such event');
  else throw e;
}

// Walk every page of a list without managing page numbers
for await (const item of orbit.news.iterate({ tag: 'release' })) console.log(item.title);

// Upload an image (JPEG/PNG/etc., max 5 MB); embed the url in Markdown as ![](url)
const { url } = await orbit.uploads.upload(file);
// Returned URLs are absolute and publicly reachable from the API origin, not necessarily your frontend.
const imageUrl = new URL(url, 'https://orbit.example.com').href;
await orbit.forum.createPost({ title: 'Team photo', content: `![Team photo](${imageUrl})` });
```

Friendly types are exported too: `User`, `Role`, `UserStatus`, `LoginMethod`, `Event`, `Announcement`, `News`,
`BlogPost`, `ForumPost`, `ForumComment`, `Notification`.

For example, an authorized admin can promote a member without changing other fields:

```ts
await orbit.users.update(memberId, { role: 'ADMIN' });
```

The SDK does not poll `/api/auth/me`; consumers should refresh it when they need to
update role-dependent controls. The API enforces the current saved role on each
authenticated HTTP request.

## Options

`createTeamOrbitClient(options)`

| Option | Type | Description |
| --- | --- | --- |
| `baseUrl` | `string` | Base URL of your deployed API, with no trailing path. **Required.** |
| `token` | `string \| () => string \| undefined \| Promise<...>` | JWT sent as `Authorization: Bearer <token>`. A function is called on every request. Optional: `auth.login()` stores a token for you. |
| `fetch` | `typeof fetch` | Custom `fetch`, useful for tests, proxies or older runtimes. |

## Low-level API

The client is also a plain [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) client with
`GET`, `POST`, `PUT`, `PATCH`, `DELETE` and `use()` ([middleware](https://openapi-ts.dev/openapi-fetch/middleware-auth)).
These **never throw on HTTP errors**; each returns `{ data, error, response }`:

```ts
const { data, error, response } = await orbit.GET('/forum-posts/{id}', {
  params: { path: { id } },
});
if (error) console.error(response.status, error); // { statusCode, message: string | string[], error? }
else console.log(data.title);
```

Network failures still reject the promise. Use this when you want to branch on errors without
`try/catch`, or for endpoints without a helper.

## Roles and permissions

| Role | Can do |
| --- | --- |
| `USER` | Read events, announcements, news, blog posts, forum and notifications; post, comment and vote in the forum; edit or delete their own forum posts and comments; manage their own profile. |
| `ADMIN` | Everything a `USER` can, plus manage users, promote USER to ADMIN, create/update/delete events, announcements, news and blog posts, and moderate the forum. Cannot change existing ADMIN or SUPERUSER roles. |
| `SUPERUSER` | Everything an `ADMIN` can, plus create and modify superusers. |

New accounts from `POST /api/auth/register` start as `PENDING` and **cannot log in** until an
admin sets their status to `ACTIVE`. Login is rate limited to 10 requests per minute.

## API reference

Generated from the OpenAPI spec. Every request body and response name below is a schema
under `components['schemas']`. List endpoints accept `page`, `limit` (max 100) and `q`
(search); `news` and `blog-posts` also accept `tag`, and `users` accepts `status`.

<!-- api:start -->
#### auth

| Method | Path | Auth | Request body | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/auth/register` | public | `RegisterDto` | `UserDto` |
| `POST` | `/api/auth/login` | public | `LoginDto` | `LoginResponseDto` |
| `GET` | `/api/auth/me` | Bearer |  | `UserDto` |
| `PATCH` | `/api/auth/me` | Bearer | `UpdateProfileDto` | `UserDto` |
| `POST` | `/api/auth/change-password` | Bearer | `ChangePasswordDto` | `OkDto` |

#### users

| Method | Path | Auth | Request body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/users` | Bearer |  | `PaginatedUsersDto` |
| `POST` | `/api/users` | Bearer | `CreateUserDto` | `UserDto` |
| `GET` | `/api/users/{id}` | Bearer |  | `UserDto` |
| `PATCH` | `/api/users/{id}` | Bearer | `UpdateUserDto` | `UserDto` |
| `DELETE` | `/api/users/{id}` | Bearer |  | `OkDto` |

#### avatars

| Method | Path | Auth | Request body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/avatars` | public |  | `AvatarPresetsDto` |

#### announcements

| Method | Path | Auth | Request body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/announcements` | Bearer |  | `PaginatedAnnouncementsDto` |
| `POST` | `/api/announcements` | Bearer | `CreateAnnouncementDto` | `AnnouncementDto` |
| `GET` | `/api/announcements/{id}` | Bearer |  | `AnnouncementDto` |
| `PATCH` | `/api/announcements/{id}` | Bearer | `UpdateAnnouncementDto` | `AnnouncementDto` |
| `DELETE` | `/api/announcements/{id}` | Bearer |  | `OkDto` |

#### notifications

| Method | Path | Auth | Request body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/notifications` | Bearer |  | `PaginatedNotificationsDto` |
| `POST` | `/api/notifications/read-all` | Bearer |  | `MarkAllReadDto` |
| `POST` | `/api/notifications/{id}/read` | Bearer |  | `NotificationReadDto` |
| `DELETE` | `/api/notifications/{id}` | Bearer |  | `OkDto` |

#### events

| Method | Path | Auth | Request body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/events` | Bearer |  | `PaginatedEventsDto` |
| `POST` | `/api/events` | Bearer | `CreateEventDto` | `EventDto` |
| `GET` | `/api/events/{id}` | Bearer |  | `EventDto` |
| `PATCH` | `/api/events/{id}` | Bearer | `UpdateEventDto` | `EventDto` |
| `DELETE` | `/api/events/{id}` | Bearer |  | `OkDto` |

#### news

| Method | Path | Auth | Request body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/news` | Bearer |  | `PaginatedNewsListDto` |
| `POST` | `/api/news` | Bearer | `CreateNewsDto` | `NewsDto` |
| `GET` | `/api/news/{id}` | Bearer |  | `NewsDto` |
| `PATCH` | `/api/news/{id}` | Bearer | `UpdateNewsDto` | `NewsDto` |
| `DELETE` | `/api/news/{id}` | Bearer |  | `OkDto` |

#### blog-posts

| Method | Path | Auth | Request body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/blog-posts` | Bearer |  | `PaginatedBlogPostListDto` |
| `POST` | `/api/blog-posts` | Bearer | `CreateBlogPostDto` | `BlogPostDto` |
| `GET` | `/api/blog-posts/{id}` | Bearer |  | `BlogPostDto` |
| `PATCH` | `/api/blog-posts/{id}` | Bearer | `UpdateBlogPostDto` | `BlogPostDto` |
| `DELETE` | `/api/blog-posts/{id}` | Bearer |  | `OkDto` |

#### forum-posts

| Method | Path | Auth | Request body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/forum-posts` | Bearer |  | `PaginatedForumPostsDto` |
| `POST` | `/api/forum-posts` | Bearer | `CreateForumPostDto` | `ForumPostCreatedDto` |
| `GET` | `/api/forum-posts/{id}` | Bearer |  | `ForumPostDetailDto` |
| `PATCH` | `/api/forum-posts/{id}` | Bearer | `UpdateForumPostDto` | `ForumPostDto` |
| `DELETE` | `/api/forum-posts/{id}` | Bearer |  | `OkDto` |
| `POST` | `/api/forum-posts/{id}/comments` | Bearer | `CreateForumCommentDto` | `ForumCommentDto` |
| `PUT` | `/api/forum-posts/{id}/vote` | Bearer | `VoteDto` | `VoteResultDto` |
| `PATCH` | `/api/forum-comments/{id}` | Bearer | `UpdateForumCommentDto` | `ForumCommentBaseDto` |
| `DELETE` | `/api/forum-comments/{id}` | Bearer |  | `OkDto` |
| `PUT` | `/api/forum-comments/{id}/vote` | Bearer | `VoteDto` | `VoteResultDto` |

#### uploads

| Method | Path | Auth | Request body | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/uploads` | Bearer | multipart | `UploadResultDto` |

#### health

| Method | Path | Auth | Request body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/health` | public |  | `HealthDto` |
<!-- api:end -->

## Not included

- **Realtime notifications.** The API emits `notification:new` over Socket.IO (global to all
  authenticated clients, or directed to specific user rooms). Use `socket.io-client` for that. This
  package covers the REST API only (list, mark read, mark all read, and per-user delete/dismiss).
  List responses include `audience` (`GLOBAL` | `DIRECTED`).
- **Per-status error types.** Every failure shares one `error` type, so use `response.status`
  (401, 403, 404, ...) to tell them apart.

## Versioning

The client is generated from the API's OpenAPI spec, so new endpoints and fields show up
in the next release of this package. Pin the version if your deployed API lags behind.
Version 0.1.0 is the initial release and targets the current `/api` contract. It includes
username/email login, nullable account email, avatar presets, and absolute upload URLs.
See the [0.1.0 release notes](CHANGELOG.md).

## Contributing / regenerating

In the [repository](https://github.com/cyborgoat/team-orbit):

```bash
cd api
npm run openapi:export       # writes openapi/openapi.json
cd ../packages/client
npm test                    # regenerate types/API table, compile, and run tests
cd ../..
./scripts/check-sdk.sh       # checks generated files against Git
```

The consistency script compares generated files with Git. Regenerated changes
must be included in the same commit as the API change for that check to pass.

## License

MIT
