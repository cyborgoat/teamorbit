import type { Client } from 'openapi-fetch';
import { unwrap } from './errors.js';
import type { BodyOf, LoginMethod, QueryOf, ResponseOf } from './types.js';
import type { paths } from './schema.js';

type Raw = Client<paths>;
// The generic helpers below call the raw client with computed paths, which the
// compiler cannot narrow; the public signatures are what keep callers type-safe.
type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type DynamicClient = Record<HttpMethod, (path: string, init: object) => Promise<{ data?: unknown; error?: unknown; response: Response }>>;

const call = async (client: Raw, method: HttpMethod, path: string, init?: object) =>
  unwrap(await (client as unknown as DynamicClient)[method](path, init ?? {}));

type Page<T> = { items: T[]; total: number; page: number; limit: number };

/** Builds list/get/create/update/delete for a standard `/<collection>` + `/<collection>/{id}` resource. */
function crud<
  C extends '/api/users' | '/api/announcements' | '/api/events' | '/api/news' | '/api/blog-posts',
  I extends '/api/users/{id}' | '/api/announcements/{id}' | '/api/events/{id}' | '/api/news/{id}' | '/api/blog-posts/{id}',
>(client: Raw, collection: C, item: I) {
  const withId = (id: string) => ({ params: { path: { id } } });

  async function list(query?: QueryOf<C>, options?: { signal?: AbortSignal }) {
    return call(client, 'GET', collection, { params: { query }, ...options }) as Promise<ResponseOf<C, 'get'>>;
  }

  return {
    list,
    get: (id: string) => call(client, 'GET', item, withId(id)) as Promise<ResponseOf<I, 'get'>>,
    create: (body: BodyOf<C, 'post'>) =>
      call(client, 'POST', collection, { body }) as Promise<ResponseOf<C, 'post'>>,
    update: (id: string, body: BodyOf<I, 'patch'>) =>
      call(client, 'PATCH', item, { ...withId(id), body }) as Promise<ResponseOf<I, 'patch'>>,
    delete: (id: string) => call(client, 'DELETE', item, withId(id)) as Promise<ResponseOf<I, 'delete'>>,
    /** Async iterator over every item, fetching pages on demand. */
    async *iterate(query?: Omit<NonNullable<QueryOf<C>>, 'page'>) {
      for (let page = 1; ; page++) {
        const res = (await list({ ...query, page } as unknown as QueryOf<C>)) as unknown as Page<unknown>;
        yield* res.items as Array<ResponseOf<C, 'get'> extends { items: (infer T)[] } ? T : never>;
        if (res.page * res.limit >= res.total || res.items.length === 0) return;
      }
    },
  };
}

export function createResources(client: Raw, auth: { setToken(t: string | undefined): void }) {
  const withId = (id: string) => ({ params: { path: { id } } });

  return {
    avatars: {
      /** Lists the public preset catalogue with absolute image URLs. */
      list: () => call(client, 'GET', '/api/avatars') as Promise<ResponseOf<'/api/avatars', 'get'>>,
    },
    auth: {
      /** Registers a PENDING member. Email may be omitted or null. */
      register: (body: BodyOf<'/api/auth/register', 'post'>) =>
        call(client, 'POST', '/api/auth/register', { body }) as Promise<ResponseOf<'/api/auth/register', 'post'>>,
      /**
       * Logs in and remembers the returned token for later requests.
       * Infers email when identifier contains @; otherwise uses username.
       * Pass method explicitly for usernames containing @.
       */
      async login(
        identifier: string,
        password: string,
        method: LoginMethod = identifier.includes('@') ? 'email' : 'username',
      ) {
        const res = (await call(client, 'POST', '/api/auth/login', {
          body: { [method]: identifier, password },
        })) as ResponseOf<'/api/auth/login', 'post'>;
        auth.setToken(res.accessToken);
        return res;
      },
      logout: () => auth.setToken(undefined),
      me: (options?: { signal?: AbortSignal }) => call(client, 'GET', '/api/auth/me', options) as Promise<ResponseOf<'/api/auth/me', 'get'>>,
      updateMe: (body: BodyOf<'/api/auth/me', 'patch'>) =>
        call(client, 'PATCH', '/api/auth/me', { body }) as Promise<ResponseOf<'/api/auth/me', 'patch'>>,
      changePassword: (body: BodyOf<'/api/auth/change-password', 'post'>) =>
        call(client, 'POST', '/api/auth/change-password', { body }) as Promise<
          ResponseOf<'/api/auth/change-password', 'post'>
        >,
    },
    users: crud(client, '/api/users', '/api/users/{id}'),
    events: crud(client, '/api/events', '/api/events/{id}'),
    announcements: crud(client, '/api/announcements', '/api/announcements/{id}'),
    news: crud(client, '/api/news', '/api/news/{id}'),
    blogPosts: crud(client, '/api/blog-posts', '/api/blog-posts/{id}'),
    notifications: {
      list: (query?: QueryOf<'/api/notifications'>) =>
        call(client, 'GET', '/api/notifications', { params: { query } }) as Promise<
          ResponseOf<'/api/notifications', 'get'>
        >,
      markRead: (id: string) =>
        call(client, 'POST', '/api/notifications/{id}/read', withId(id)) as Promise<
          ResponseOf<'/api/notifications/{id}/read', 'post'>
        >,
      markUnread: (id: string) =>
        call(client, 'DELETE', '/api/notifications/{id}/read', withId(id)) as Promise<
          ResponseOf<'/api/notifications/{id}/read', 'delete'>
        >,
      markAllRead: () =>
        call(client, 'POST', '/api/notifications/read-all') as Promise<
          ResponseOf<'/api/notifications/read-all', 'post'>
        >,
      delete: (id: string) =>
        call(client, 'DELETE', '/api/notifications/{id}', withId(id)) as Promise<
          ResponseOf<'/api/notifications/{id}', 'delete'>
        >,
      restore: (id: string) =>
        call(client, 'POST', '/api/notifications/{id}/restore', withId(id)) as Promise<
          ResponseOf<'/api/notifications/{id}/restore', 'post'>
        >,
    },
    comments: {
      list: (query: QueryOf<'/api/comments'>) =>
        call(client, 'GET', '/api/comments', { params: { query } }) as Promise<
          ResponseOf<'/api/comments', 'get'>
        >,
      create: (body: BodyOf<'/api/comments', 'post'>) =>
        call(client, 'POST', '/api/comments', { body }) as Promise<ResponseOf<'/api/comments', 'post'>>,
      update: (id: string, body: BodyOf<'/api/comments/{id}', 'patch'>) =>
        call(client, 'PATCH', '/api/comments/{id}', { ...withId(id), body }) as Promise<
          ResponseOf<'/api/comments/{id}', 'patch'>
        >,
      delete: (id: string) =>
        call(client, 'DELETE', '/api/comments/{id}', withId(id)) as Promise<
          ResponseOf<'/api/comments/{id}', 'delete'>
        >,
      /** `1` = up, `-1` = down, `0` = clear. */
      vote: (id: string, value: BodyOf<'/api/comments/{id}/vote', 'put'>['value']) =>
        call(client, 'PUT', '/api/comments/{id}/vote', { ...withId(id), body: { value } }) as Promise<
          ResponseOf<'/api/comments/{id}/vote', 'put'>
        >,
    },
    forum: {
      listPosts: (query?: QueryOf<'/api/forum-posts'>) =>
        call(client, 'GET', '/api/forum-posts', { params: { query } }) as Promise<ResponseOf<'/api/forum-posts', 'get'>>,
      getPost: (id: string) =>
        call(client, 'GET', '/api/forum-posts/{id}', withId(id)) as Promise<ResponseOf<'/api/forum-posts/{id}', 'get'>>,
      createPost: (body: BodyOf<'/api/forum-posts', 'post'>) =>
        call(client, 'POST', '/api/forum-posts', { body }) as Promise<ResponseOf<'/api/forum-posts', 'post'>>,
      updatePost: (id: string, body: BodyOf<'/api/forum-posts/{id}', 'patch'>) =>
        call(client, 'PATCH', '/api/forum-posts/{id}', { ...withId(id), body }) as Promise<
          ResponseOf<'/api/forum-posts/{id}', 'patch'>
        >,
      deletePost: (id: string) =>
        call(client, 'DELETE', '/api/forum-posts/{id}', withId(id)) as Promise<
          ResponseOf<'/api/forum-posts/{id}', 'delete'>
        >,
      /** `1` = up, `-1` = down, `0` = clear. */
      votePost: (id: string, value: BodyOf<'/api/forum-posts/{id}/vote', 'put'>['value']) =>
        call(client, 'PUT', '/api/forum-posts/{id}/vote', { ...withId(id), body: { value } }) as Promise<
          ResponseOf<'/api/forum-posts/{id}/vote', 'put'>
        >,
    },
    uploads: {
      /** Admin-only orphan preview; reconciles existing files without deleting them. */
      cleanupPreview: (query?: QueryOf<'/api/uploads/cleanup'>) =>
        call(client, 'GET', '/api/uploads/cleanup', { params: { query } }) as Promise<ResponseOf<'/api/uploads/cleanup', 'get'>>,
      /** Admin-only background cleanup using the configured grace period. */
      startCleanup: () => call(client, 'POST', '/api/uploads/cleanup') as Promise<ResponseOf<'/api/uploads/cleanup', 'post'>>,
      /** Uploads an image (max 5 MB). Returns `{ url }`, as an absolute public URL. */
      upload(file: Blob, filename?: string) {
        const form = new FormData();
        if (filename) form.append('file', file, filename);
        else form.append('file', file);
        return call(client, 'POST', '/api/uploads', { body: {}, bodySerializer: () => form }) as Promise<
          ResponseOf<'/api/uploads', 'post'>
        >;
      },
    },
    health: () => call(client, 'GET', '/api/health') as Promise<ResponseOf<'/api/health', 'get'>>,
  };
}
