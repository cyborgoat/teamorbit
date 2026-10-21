import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamOrbitClient, TeamOrbitError } from '../dist/index.js';

function mockFetch(handler) {
  const calls = [];
  const fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    calls.push(request);
    const { status = 200, body = {} } = await handler(request, calls.length);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}

test('avatar presets are available without signing in', async () => {
  const items = [{ id: 'grumpy-raven', name: 'Grumpy Raven', url: 'https://orbit.example/avatars/default-raven.png', isDefault: true }];
  const { fetch, calls } = mockFetch(() => ({ body: { items } }));
  const orbit = createTeamOrbitClient({ baseUrl: 'https://orbit.example', fetch });
  assert.deepEqual(await orbit.avatars.list(), { items });
  assert.equal(calls[0].method, 'GET');
  assert.equal(new URL(calls[0].url).pathname, '/api/avatars');
  assert.equal(calls[0].headers.get('authorization'), null);
});

test('login stores the token and sends it on later requests', async () => {
  const { fetch, calls } = mockFetch((req) =>
    new URL(req.url).pathname === '/api/auth/login' ? { body: { accessToken: 'abc' } } : { body: { id: '1' } },
  );
  const orbit = createTeamOrbitClient({ baseUrl: 'http://x', fetch });
  await orbit.auth.login('a@b.c', 'pw');
  await orbit.auth.me();
  assert.equal(calls[0].headers.get('authorization'), null);
  assert.equal(calls[1].headers.get('authorization'), 'Bearer abc');
});

test('token option function is used when no login token is set', async () => {
  const { fetch, calls } = mockFetch(() => ({ body: {} }));
  const orbit = createTeamOrbitClient({ baseUrl: 'http://x', token: () => 't1', fetch });
  await orbit.health();
  assert.equal(calls[0].headers.get('authorization'), 'Bearer t1');
});

test('helpers throw TeamOrbitError with joined validation messages', async () => {
  const { fetch } = mockFetch(() => ({ status: 400, body: { statusCode: 400, message: ['a bad', 'b bad'] } }));
  const orbit = createTeamOrbitClient({ baseUrl: 'http://x', fetch });
  await assert.rejects(orbit.news.create({ title: '', content: '' }), (e) => {
    assert.ok(e instanceof TeamOrbitError);
    assert.equal(e.status, 400);
    assert.equal(e.message, 'a bad; b bad');
    return true;
  });
});

test('raw methods still return { error } without throwing', async () => {
  const { fetch } = mockFetch(() => ({ status: 401, body: { statusCode: 401, message: 'Unauthorized' } }));
  const orbit = createTeamOrbitClient({ baseUrl: 'http://x', fetch });
  const { data, error, response } = await orbit.GET('/api/auth/me');
  assert.equal(data, undefined);
  assert.equal(error.message, 'Unauthorized');
  assert.equal(response.status, 401);
});

test('iterate walks every page', async () => {
  const { fetch, calls } = mockFetch((req) => {
    const page = Number(new URL(req.url).searchParams.get('page'));
    return { body: { items: [{ id: `n${page}a` }, { id: `n${page}b` }], total: 4, page, limit: 2 } };
  });
  const orbit = createTeamOrbitClient({ baseUrl: 'http://x', fetch });
  const ids = [];
  for await (const n of orbit.news.iterate()) ids.push(n.id);
  assert.deepEqual(ids, ['n1a', 'n1b', 'n2a', 'n2b']);
  assert.equal(calls.length, 2);
});

test('upload sends multipart form data', async () => {
  const { fetch, calls } = mockFetch(() => ({ body: { url: '/api/uploads/x.png' } }));
  const orbit = createTeamOrbitClient({ baseUrl: 'http://x', fetch });
  const res = await orbit.uploads.upload(new Blob(['hi'], { type: 'image/png' }), 'x.png');
  assert.equal(res.url, '/api/uploads/x.png');
  assert.match(calls[0].headers.get('content-type'), /multipart\/form-data/);
});

test('vote and path params are wired correctly', async () => {
  const { fetch, calls } = mockFetch(() => ({ body: { score: 1 } }));
  const orbit = createTeamOrbitClient({ baseUrl: 'http://x', fetch });
  await orbit.forum.votePost('p1', 1);
  assert.equal(calls[0].method, 'PUT');
  assert.equal(new URL(calls[0].url).pathname, '/api/forum-posts/p1/vote');
  assert.deepEqual(await calls[0].json(), { value: 1 });
});


test('login accepts username and explicit email mode with optional email inference', async () => {
  const { fetch, calls } = mockFetch(() => ({ body: { accessToken: 'abc' } }));
  const orbit = createTeamOrbitClient({ baseUrl: 'http://x', fetch });
  await orbit.auth.login('member', 'secret');
  await orbit.auth.login('member@example.com', 'secret');
  await orbit.auth.login('name@work', 'secret', 'username');
  await orbit.auth.login('member@example.com', 'secret', 'email');
  assert.deepEqual(await calls[0].json(), { username: 'member', password: 'secret' });
  assert.deepEqual(await calls[1].json(), { email: 'member@example.com', password: 'secret' });
  assert.deepEqual(await calls[2].json(), { username: 'name@work', password: 'secret' });
  assert.deepEqual(await calls[3].json(), { email: 'member@example.com', password: 'secret' });
});

test('registration omits email and profile can clear it', async () => {
  const { fetch, calls } = mockFetch(() => ({ body: { id: 'member', email: null } }));
  const orbit = createTeamOrbitClient({ baseUrl: 'http://x', fetch });
  await orbit.auth.register({ username: 'member', fullName: 'Member', password: 'secret' });
  assert.equal('email' in await calls[0].json(), false);
  await orbit.auth.updateMe({ email: null });
  assert.deepEqual(await calls[1].json(), { email: null });
});


test('admin cleanup helpers send pagination and accept a background run response', async () => {
  const { fetch, calls } = mockFetch(request => request.method === 'POST' ? { status: 202, body: { id: 'cleanup-run' } } : { body: { items: [], total: 0 } });
  const orbit = createTeamOrbitClient({ baseUrl: 'https://orbit.example', token: 'admin-token', fetch });
  assert.deepEqual(await orbit.uploads.cleanupPreview({ page: 2, limit: 10 }), { items: [], total: 0 });
  assert.equal(new URL(calls[0].url).pathname, '/api/uploads/cleanup');
  assert.equal(new URL(calls[0].url).searchParams.get('page'), '2');
  assert.deepEqual(await orbit.uploads.startCleanup(), { id: 'cleanup-run' });
  assert.equal(calls[1].method, 'POST');
  assert.equal(calls[1].headers.get('authorization'), 'Bearer admin-token');
});
