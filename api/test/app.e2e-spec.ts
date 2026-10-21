import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../src/notifications/notifications.service';
import { NotificationsGateway } from '../src/notifications/notifications.gateway';
import { JwtService } from '@nestjs/jwt';
import { io } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { configureApp } from '../src/common/configure-app';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HttpAdapterHost } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import request from 'supertest';
import { App } from 'supertest/types';
import { ThrottlerStorage } from '@nestjs/throttler';
import { PrismaService } from '../src/prisma/prisma.service';
import type { UserDto } from '../src/users/dto/user.dto';
import type { LoginResponseDto } from '../src/auth/dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';

const bodyOf = (response: { body: unknown }) =>
  response.body as UserDto & LoginResponseDto;

describe('App (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdIds: string[] = [];
  const prefix = `auth-test-${Date.now()}`;
  const password = 'password123';
  const adminUsername = `${prefix}-admin`;
  const adminEmail = `${prefix}-admin@example.test`;

  beforeAll(async () => {
    // ServeStaticModule selects its loader during compilation; provide the real
    // HTTP adapter then, as NestFactory does in the running service.
    const adapter = new ExpressAdapter();
    const adapterHost = new HttpAdapterHost();
    adapterHost.httpAdapter = adapter;
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HttpAdapterHost)
      .useValue(adapterHost)
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: () =>
          Promise.resolve({
            totalHits: 1,
            timeToExpire: 60,
            isBlocked: false,
            timeToBlockExpire: 0,
          }),
      })
      .compile();

    app = moduleFixture.createNestApplication(adapter);
    configureApp(app);
    await app.init();
    await app.listen(0, '127.0.0.1');
    const server = app.getHttpServer() as unknown as import('node:http').Server;
    const address = server.address() as AddressInfo;
    process.env.PUBLIC_BASE_URL = `http://127.0.0.1:${address.port}`;
    app.get(ConfigService).set('PUBLIC_BASE_URL', process.env.PUBLIC_BASE_URL);
    prisma = app.get(PrismaService);
    const admin = await prisma.user.create({
      data: {
        username: adminUsername,
        fullName: 'Integration Admin',
        email: adminEmail,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    createdIds.push(admin.id);
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(bodyOf(res).status).toBe('ok');
      });
  });

  it.each(['orbit', 'metrics', 'workshop'])(
    'does not serve bundled demo illustration %s',
    async (name) => {
      await request(app.getHttpServer()).get(`/demo/${name}.svg`).expect(404);
    },
  );

  it('serves the default animal avatar publicly to other apps', async () => {
    await request(app.getHttpServer())
      .get('/avatars/default-raven.png')
      .set('Origin', 'http://localhost:1420')
      .expect(200)
      .expect('Content-Type', /image\/png/)
      .expect('Access-Control-Allow-Origin', 'http://localhost:1420');
  });

  it('lists five public avatar presets with working absolute image URLs', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/avatars')
      .expect(200);
    const { items } = response.body as {
      items: { id: string; name: string; url: string; isDefault: boolean }[];
    };
    expect(items).toHaveLength(5);
    expect(new Set(items.map((item) => item.id)).size).toBe(5);
    expect(items.filter((item) => item.isDefault)).toHaveLength(1);
    for (const preset of items) {
      expect(preset.url).toMatch(/^https?:\/\//);
      const image = await request(app.getHttpServer())
        .get(new URL(preset.url).pathname)
        .expect(200)
        .expect('Content-Type', /image\/png/);
      expect((image.body as Buffer).length).toBeGreaterThan(100);
    }
  });

  it('supports default, custom, and reset avatars for members and admins', async () => {
    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        username: `${prefix}-avatar`,
        fullName: 'Avatar Member',
        password,
      })
      .expect(201);
    const member = bodyOf(registered);
    createdIds.push(member.id);
    expect(member.avatarUrl).toMatch(
      /^https?:\/\/[^\s]+\/avatars\/default-raven\.png$/,
    );
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: member.id } }))
        .avatarUrl,
    ).toBeNull();
    await prisma.user.update({
      where: { id: member.id },
      data: { status: 'ACTIVE' },
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: member.username, password })
      .expect(201);
    const token = bodyOf(login).accessToken;
    expect(bodyOf(login).user.avatarUrl).toMatch(
      /\/avatars\/default-raven\.png$/,
    );
    await request(app.getHttpServer())
      .patch('/api/auth/me')
      .auth(token, { type: 'bearer' })
      .send({ avatarUrl: '/uploads/avatar-test.png' })
      .expect(200)
      .expect((res) =>
        expect(bodyOf(res).avatarUrl).toMatch(
          /^https?:\/\/[^\s]+\/uploads\/avatar-test\.png$/,
        ),
      );
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(200)
      .expect((res) =>
        expect(bodyOf(res).avatarUrl).toMatch(/\/uploads\/avatar-test\.png$/),
      );
    await request(app.getHttpServer())
      .patch('/api/auth/me')
      .auth(token, { type: 'bearer' })
      .send({ avatarUrl: null })
      .expect(200)
      .expect((res) =>
        expect(bodyOf(res).avatarUrl).toMatch(/\/avatars\/default-raven\.png$/),
      );
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: adminUsername, password })
      .expect(201);
    const adminToken = bodyOf(adminLogin).accessToken;
    await request(app.getHttpServer())
      .patch(`/api/users/${member.id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ avatarUrl: 'https://images.example.com/custom.png' })
      .expect(200)
      .expect((res) =>
        expect(bodyOf(res).avatarUrl).toBe(
          'https://images.example.com/custom.png',
        ),
      );
    await request(app.getHttpServer())
      .patch(`/api/users/${member.id}`)
      .auth(adminToken, { type: 'bearer' })
      .send({ avatarUrl: null })
      .expect(200)
      .expect((res) =>
        expect(bodyOf(res).avatarUrl).toMatch(/\/avatars\/default-raven\.png$/),
      );
    await request(app.getHttpServer())
      .patch(`/api/users/${member.id}`)
      .auth(token, { type: 'bearer' })
      .send({ avatarUrl: null })
      .expect(403);
  });

  it('/auth/login (POST) with an isolated test admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'password123' })
      .expect(201);
    expect(bodyOf(res).accessToken).toBeDefined();
  });

  it('logs in with the test admin username', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: adminUsername, password })
      .expect(201);
    expect(bodyOf(res).user.username).toBe(adminUsername);
    expect(bodyOf(res).accessToken).toBeDefined();
  });

  it.each([
    { password: 'password123' },
    {
      username: adminUsername,
      email: adminEmail,
      password: 'password123',
    },
    { username: '', password: 'password123' },
    { email: 'not-an-email', password: 'password123' },
  ])(
    'rejects missing, ambiguous, or invalid login identifiers: %j',
    async (payload) => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(payload)
        .expect(400);
    },
  );

  it.each([
    { username: adminUsername, password: 'wrong-password' },
    { username: 'no-such-user', password: 'password123' },
    { email: 'nobody@teamorbit.local', password: 'password123' },
  ])('rejects invalid credentials: %j', async (payload) => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(payload)
      .expect(401);
  });

  it('allows multiple registrations without email, preserving approval and username uniqueness', async () => {
    const register = async (suffix: string, email?: string | null) => {
      const result = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          username: `${prefix}-${suffix}`,
          fullName: 'No Email Member',
          password,
          ...(email !== undefined ? { email } : {}),
        })
        .expect(201);
      createdIds.push(bodyOf(result).id);
      expect(bodyOf(result).email).toBeNull();
      expect(bodyOf(result).status).toBe('PENDING');
      return bodyOf(result);
    };
    const first = await register('omitted');
    await register('empty', '');
    await register('null', null);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: first.username, password })
      .expect(401);
    await prisma.user.update({
      where: { id: first.id },
      data: { status: 'ACTIVE' },
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: first.username, password })
      .expect(201);
    expect(bodyOf(login).user.email).toBeNull();
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(bodyOf(login).accessToken, { type: 'bearer' })
      .expect(200)
      .expect((res) => expect(bodyOf(res).email).toBeNull());
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ username: first.username, fullName: 'Duplicate', password })
      .expect(409);
  });

  it('validates optional email, keeps it unique, and allows adding and removing it', async () => {
    const payload = {
      username: `${prefix}-email`,
      fullName: 'Email Member',
      password,
      email: `${prefix}@example.com`,
    };
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...payload, email: 'invalid-email' })
      .expect(400);
    const result = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(payload)
      .expect(201);
    createdIds.push(bodyOf(result).id);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ ...payload, username: `${prefix}-duplicate-email` })
      .expect(409);
    await prisma.user.update({
      where: { id: bodyOf(result).id },
      data: { status: 'ACTIVE' },
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: payload.email, password })
      .expect(201);
    const token = bodyOf(login).accessToken;
    await request(app.getHttpServer())
      .patch('/api/auth/me')
      .auth(token, { type: 'bearer' })
      .send({ email: null })
      .expect(200)
      .expect((res) => expect(bodyOf(res).email).toBeNull());
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: payload.email, password })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: payload.username, password })
      .expect(201);
    await request(app.getHttpServer())
      .patch('/api/auth/me')
      .auth(token, { type: 'bearer' })
      .send({ email: payload.email })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: payload.email, password })
      .expect(201);
    await request(app.getHttpServer())
      .patch('/api/auth/me')
      .auth(token, { type: 'bearer' })
      .send({ email: '' })
      .expect(200)
      .expect((res) => expect(bodyOf(res).email).toBeNull());
  });

  it('allows an admin to create an active account without email', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: adminUsername, password })
      .expect(201);
    const result = await request(app.getHttpServer())
      .post('/api/users')
      .auth(bodyOf(login).accessToken, { type: 'bearer' })
      .send({
        username: `${prefix}-admin-created`,
        fullName: 'Admin Created',
        password,
      })
      .expect(201);
    createdIds.push(bodyOf(result).id);
    expect(bodyOf(result).email).toBeNull();
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: bodyOf(result).username, password })
      .expect(201);
  });

  it.each(['INACTIVE', 'SUSPENDED', 'DELETED'] as const)(
    'continues to reject %s accounts',
    async (status) => {
      const username = `${prefix}-${status.toLowerCase()}`;
      const user = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ username, fullName: 'Blocked Member', password })
        .expect(201);
      createdIds.push(bodyOf(user).id);
      await prisma.user.update({
        where: { id: bodyOf(user).id },
        data: { status },
      });
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username, password })
        .expect(401);
    },
  );
  const dataOf = (response: { body: unknown }) =>
    response.body as {
      id: string;
      tags: string[];
      total: number;
      items: { title: string }[];
      coverImageUrl: string | null;
      url: string;
    };
  async function adminToken() {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: adminUsername, password })
      .expect(201);
    return bodyOf(response).accessToken;
  }

  it('validates configuration, media, exact tags, pagination and nullable updates', async () => {
    const token = await adminToken();
    const create = (title: string, tags: string[]) =>
      request(app.getHttpServer())
        .post('/api/news')
        .auth(token, { type: 'bearer' })
        .send({
          title,
          content: '# Hello',
          tags,
          coverImageUrl: 'https://images.example/test.png',
        });
    const first = await create('Exact tags', [' art ', 'art', 'team']);
    expect(first.status).toBe(201);
    expect(dataOf(first).tags).toEqual(expect.arrayContaining(['art', 'team']));
    expect(dataOf(first).tags).toHaveLength(2);
    await create('Substring should not match', ['cartography']).expect(201);
    const filtered = await request(app.getHttpServer())
      .get('/api/news?tag=art&limit=1&page=1')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(dataOf(filtered).total).toBe(1);
    expect(dataOf(filtered).items[0].title).toBe('Exact tags');
    await request(app.getHttpServer())
      .get('/api/news?page=0')
      .auth(token, { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/users?status=WRONG')
      .auth(token, { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/news/${dataOf(first).id}`)
      .auth(token, { type: 'bearer' })
      .send({ coverImageUrl: null, tags: [] })
      .expect(200)
      .expect((res) => {
        expect(dataOf(res).coverImageUrl).toBeNull();
        expect(dataOf(res).tags).toEqual([]);
      });
    await request(app.getHttpServer())
      .patch('/api/auth/me')
      .auth(token, { type: 'bearer' })
      .send({ avatarUrl: 'javascript:alert(1)' })
      .expect(400);
    await request(app.getHttpServer())
      .delete(`/api/news/${dataOf(first).id}`)
      .auth(token, { type: 'bearer' })
      .expect(200, { ok: true });
    await request(app.getHttpServer())
      .post('/api/users')
      .auth(token, { type: 'bearer' })
      .send({ username: adminUsername, fullName: 'Duplicate', password })
      .expect(409);
  });

  it('validates date ranges using existing dates on partial updates', async () => {
    const token = await adminToken();
    const dto = {
      title: 'Schedule',
      description: '',
      location: 'Room',
      startAt: '2026-11-01T10:00:00Z',
      endAt: '2026-11-01T11:00:00Z',
    };
    await request(app.getHttpServer())
      .post('/api/events')
      .auth(token, { type: 'bearer' })
      .send({ ...dto, endAt: '2026-11-01T09:00:00Z' })
      .expect(400);
    const event = await request(app.getHttpServer())
      .post('/api/events')
      .auth(token, { type: 'bearer' })
      .send(dto)
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/events/${dataOf(event).id}`)
      .auth(token, { type: 'bearer' })
      .send({ startAt: '2026-11-01T12:00:00Z' })
      .expect(400);
  });

  it('keeps concurrent post and comment votes consistent with stored vote totals', async () => {
    const token = await adminToken();
    const post = await request(app.getHttpServer())
      .post('/api/forum-posts')
      .auth(token, { type: 'bearer' })
      .send({ title: 'Votes', content: 'Vote here' })
      .expect(201);
    const comment = await request(app.getHttpServer())
      .post(`/api/forum-posts/${dataOf(post).id}/comments`)
      .auth(token, { type: 'bearer' })
      .send({ content: 'Comment' })
      .expect(201);
    for (const [collection, id] of [
      ['forum-posts', dataOf(post).id],
      ['forum-comments', dataOf(comment).id],
    ]) {
      await Promise.all(
        [1, -1, 1, 0, -1].map((value) =>
          request(app.getHttpServer())
            .put(`/api/${collection}/${id}/vote`)
            .auth(token, { type: 'bearer' })
            .send({ value })
            .expect(200),
        ),
      );
    }
    const stored = await prisma.forumPost.findUniqueOrThrow({
      where: { id: dataOf(post).id },
      include: { votes: true },
    });
    expect(stored.score).toBe(
      stored.votes.reduce((sum, vote) => sum + vote.value, 0),
    );
    const storedComment = await prisma.forumComment.findUniqueOrThrow({
      where: { id: dataOf(comment).id },
      include: { votes: true },
    });
    expect(storedComment.score).toBe(
      storedComment.votes.reduce((sum, vote) => sum + vote.value, 0),
    );
  });

  it('rolls back content with notification failure and retains committed content if broadcast fails', async () => {
    const service = app.get(NotificationsService);
    const author = await prisma.user.findUniqueOrThrow({
      where: { username: adminUsername },
    });
    await expect(
      service.createWithNotification(
        (tx) =>
          tx.news.create({
            data: { title: 'Rollback', content: 'Body', authorId: author.id },
          }),
        () => {
          throw new Error('notification payload failed');
        },
      ),
    ).rejects.toThrow('notification payload failed');
    expect(await prisma.news.count({ where: { title: 'Rollback' } })).toBe(0);
    const broadcast = jest
      .spyOn(app.get(NotificationsGateway), 'broadcastNew')
      .mockRejectedValueOnce(new Error('Offline'));
    try {
      const token = await adminToken();
      await request(app.getHttpServer())
        .post('/api/news')
        .auth(token, { type: 'bearer' })
        .send({ title: 'Committed', content: 'Body' })
        .expect(201);
      expect(await prisma.news.count({ where: { title: 'Committed' } })).toBe(
        1,
      );
      expect(
        await prisma.notification.count({ where: { body: 'Committed' } }),
      ).toBe(1);
    } finally {
      broadcast.mockRestore();
    }
  });

  it('scopes directed forum comment notifications to post or parent authors', async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { username: adminUsername },
    });
    const member = await prisma.user.create({
      data: {
        username: `${prefix}-notif-member`,
        fullName: 'Notif Member',
        passwordHash: await bcrypt.hash(password, 10),
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    createdIds.push(member.id);
    const other = await prisma.user.create({
      data: {
        username: `${prefix}-notif-other`,
        fullName: 'Notif Other',
        passwordHash: await bcrypt.hash(password, 10),
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    createdIds.push(other.id);

    const login = async (username: string) => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username, password })
        .expect(201);
      return bodyOf(response).accessToken;
    };
    const adminTok = await login(adminUsername);
    const memberTok = await login(member.username);
    const otherTok = await login(other.username);

    const listTypes = async (token: string) => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications?limit=100')
        .auth(token, { type: 'bearer' })
        .expect(200);
      return (
        res.body as {
          items: { type: string; audience: string; resourceId: string }[];
        }
      ).items;
    };

    const post = await request(app.getHttpServer())
      .post('/api/forum-posts')
      .auth(adminTok, { type: 'bearer' })
      .send({ title: 'Audience post', content: 'Body' })
      .expect(201);
    const postId = dataOf(post).id;

    const beforeSelf = await prisma.notification.count({
      where: { type: 'forum.comment.created', resourceId: postId },
    });
    await request(app.getHttpServer())
      .post(`/api/forum-posts/${postId}/comments`)
      .auth(adminTok, { type: 'bearer' })
      .send({ content: 'Self comment' })
      .expect(201);
    expect(
      await prisma.notification.count({
        where: { type: 'forum.comment.created', resourceId: postId },
      }),
    ).toBe(beforeSelf);

    const topLevel = await request(app.getHttpServer())
      .post(`/api/forum-posts/${postId}/comments`)
      .auth(memberTok, { type: 'bearer' })
      .send({ content: 'Top-level for author' })
      .expect(201);
    const directed = await prisma.notification.findFirstOrThrow({
      where: {
        type: 'forum.comment.created',
        resourceId: postId,
        audience: 'DIRECTED',
      },
      include: { recipients: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(directed.recipients.map((r) => r.userId)).toEqual([admin.id]);

    const adminItems = await listTypes(adminTok);
    const memberItems = await listTypes(memberTok);
    const otherItems = await listTypes(otherTok);
    expect(
      adminItems.some(
        (n) => n.type === 'forum.comment.created' && n.resourceId === postId,
      ),
    ).toBe(true);
    expect(
      memberItems.some(
        (n) => n.type === 'forum.comment.created' && n.resourceId === postId,
      ),
    ).toBe(false);
    expect(
      otherItems.some(
        (n) => n.type === 'forum.comment.created' && n.resourceId === postId,
      ),
    ).toBe(false);
    expect(
      otherItems.some(
        (n) => n.type === 'forum.created' && n.resourceId === postId,
      ),
    ).toBe(true);

    const parentId = dataOf(topLevel).id;
    await request(app.getHttpServer())
      .post(`/api/forum-posts/${postId}/comments`)
      .auth(otherTok, { type: 'bearer' })
      .send({ content: 'Reply to member', parentId })
      .expect(201);
    const replyNotif = await prisma.notification.findFirstOrThrow({
      where: {
        type: 'forum.comment.created',
        resourceId: postId,
        audience: 'DIRECTED',
        recipients: { some: { userId: member.id } },
      },
      include: { recipients: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(replyNotif.recipients.map((r) => r.userId)).toEqual([member.id]);

    const memberAfterReply = await listTypes(memberTok);
    expect(
      memberAfterReply.some(
        (n) => n.type === 'forum.comment.created' && n.resourceId === postId,
      ),
    ).toBe(true);
  });

  it('delivers directed notifications only to recipient sockets', async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { username: adminUsername },
    });
    const member = await prisma.user.create({
      data: {
        username: `${prefix}-socket-directed`,
        fullName: 'Socket Directed',
        passwordHash: await bcrypt.hash(password, 10),
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    createdIds.push(member.id);
    const adminTok = await adminToken();
    const memberLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: member.username, password })
      .expect(201);
    const memberTok = bodyOf(memberLogin).accessToken;

    const connect = (token: string) =>
      io(process.env.PUBLIC_BASE_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
        autoConnect: false,
      });
    const adminSocket = connect(adminTok);
    const memberSocket = connect(memberTok);
    try {
      await Promise.all(
        [adminSocket, memberSocket].map(
          (socket) =>
            new Promise<void>((resolve, reject) => {
              socket.once('connect', resolve);
              socket.once('connect_error', reject);
              socket.connect();
            }),
        ),
      );

      const adminDirected = new Promise<{ type: string; audience: string }>(
        (resolve) => adminSocket.once('notification:new', resolve),
      );
      let memberGot = false;
      memberSocket.on('notification:new', () => {
        memberGot = true;
      });

      await app.get(NotificationsService).createWithNotification(
        async () => ({ id: 'directed-socket-resource' }),
        () => ({
          audience: 'DIRECTED' as const,
          type: 'test.directed',
          title: 'Directed only',
          body: 'Body',
          resourceType: 'test',
          resourceId: 'directed-socket-resource',
          recipientIds: [admin.id],
        }),
      );

      const delivered = await Promise.race([
        adminDirected,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);
      expect(delivered).toMatchObject({
        type: 'test.directed',
        audience: 'DIRECTED',
      });
      await new Promise((r) => setTimeout(r, 200));
      expect(memberGot).toBe(false);
    } finally {
      adminSocket.close();
      memberSocket.close();
    }
  });

  it('serves real uploads at absolute URLs for another application origin', async () => {
    const token = await adminToken();
    const upload = await request(app.getHttpServer())
      .post('/api/uploads')
      .auth(token, { type: 'bearer' })
      .attach(
        'file',
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>',
        ),
        { filename: 'test.svg', contentType: 'image/svg+xml' },
      )
      .expect(201);
    expect(dataOf(upload).url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/uploads\//);
    const image = await fetch(String(dataOf(upload).url), {
      headers: { Origin: 'http://another-app.example' },
    });
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toContain('image/svg+xml');
    expect(image.headers.get('access-control-allow-origin')).toBe(
      'http://another-app.example',
    );
  });

  it('marks all notifications read and dismisses one without affecting other users', async () => {
    const member = await prisma.user.create({
      data: {
        username: `${prefix}-inbox-member`,
        fullName: 'Inbox Member',
        passwordHash: await bcrypt.hash(password, 10),
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    createdIds.push(member.id);
    const adminTok = await adminToken();
    const memberLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: member.username, password })
      .expect(201);
    const memberTok = bodyOf(memberLogin).accessToken;

    const newsA = await request(app.getHttpServer())
      .post('/api/news')
      .auth(adminTok, { type: 'bearer' })
      .send({ title: 'Inbox A', content: 'Body' })
      .expect(201);
    const newsB = await request(app.getHttpServer())
      .post('/api/news')
      .auth(adminTok, { type: 'bearer' })
      .send({ title: 'Inbox B', content: 'Body' })
      .expect(201);

    const listFor = async (token: string) => {
      const res = await request(app.getHttpServer())
        .get('/api/notifications?limit=100')
        .auth(token, { type: 'bearer' })
        .expect(200);
      return (
        res.body as {
          items: { id: string; body: string; read: boolean }[];
          total: number;
        }
      ).items;
    };

    const memberBefore = await listFor(memberTok);
    const targets = memberBefore.filter(
      (n) => n.body === 'Inbox A' || n.body === 'Inbox B',
    );
    expect(targets).toHaveLength(2);
    expect(targets.every((n) => !n.read)).toBe(true);

    const markAll = await request(app.getHttpServer())
      .post('/api/notifications/read-all')
      .auth(memberTok, { type: 'bearer' })
      .expect(201);
    expect(markAll.body).toMatchObject({ ok: true });
    expect((markAll.body as { marked: number }).marked).toBeGreaterThanOrEqual(
      2,
    );

    const memberAfterRead = await listFor(memberTok);
    expect(
      memberAfterRead
        .filter((n) => n.body === 'Inbox A' || n.body === 'Inbox B')
        .every((n) => n.read),
    ).toBe(true);

    const adminAfterMemberRead = await listFor(adminTok);
    const adminTargets = adminAfterMemberRead.filter(
      (n) => n.body === 'Inbox A' || n.body === 'Inbox B',
    );
    expect(adminTargets.some((n) => !n.read)).toBe(true);

    const dismissId = memberAfterRead.find((n) => n.body === 'Inbox A')!.id;
    await request(app.getHttpServer())
      .delete(`/api/notifications/${dismissId}`)
      .auth(memberTok, { type: 'bearer' })
      .expect(200)
      .expect({ ok: true });

    const memberAfterDismiss = await listFor(memberTok);
    expect(memberAfterDismiss.some((n) => n.body === 'Inbox A')).toBe(false);
    expect(memberAfterDismiss.some((n) => n.body === 'Inbox B')).toBe(true);

    const adminAfterDismiss = await listFor(adminTok);
    expect(adminAfterDismiss.some((n) => n.body === 'Inbox A')).toBe(true);
    expect(
      await prisma.notification.count({
        where: { resourceId: dataOf(newsA).id },
      }),
    ).toBe(1);
    expect(
      await prisma.notification.count({
        where: { resourceId: dataOf(newsB).id },
      }),
    ).toBe(1);
  });

  it('delivers committed content notifications over a real socket', async () => {
    const token = await adminToken();
    const socket = io(process.env.PUBLIC_BASE_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      autoConnect: false,
    });
    try {
      const delivered = new Promise<{ resourceId: string; title: string }>(
        (resolve) => socket.once('notification:new', resolve),
      );
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
        socket.connect();
      });
      const post = await request(app.getHttpServer())
        .post('/api/news')
        .auth(token, { type: 'bearer' })
        .send({ title: 'Socket delivery', content: 'Body' })
        .expect(201);
      const notification = await delivered;
      expect(notification.resourceId).toBe(dataOf(post).id);
      expect(notification.title).toBe('New news article');
    } finally {
      socket.close();
    }
  });

  it('disconnects real sockets on account revocation and token expiry', async () => {
    const user = await prisma.user.create({
      data: {
        username: 'socket-member',
        fullName: 'Socket Member',
        passwordHash: 'unused',
        status: 'ACTIVE',
      },
    });
    const jwt = app.get(JwtService);
    for (const expire of [false, true]) {
      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE' },
      });
      const token = jwt.sign(
        { sub: user.id },
        { expiresIn: expire ? '2s' : '1h' },
      );
      const socket = io(process.env.PUBLIC_BASE_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
        autoConnect: false,
      });
      try {
        await new Promise<void>((resolve, reject) => {
          socket.once('connect', resolve);
          socket.once('connect_error', reject);
          socket.connect();
        });
        const disconnected = new Promise<void>((resolve) => {
          socket.once('disconnect', () => resolve());
        });
        if (!expire) {
          await prisma.user.update({
            where: { id: user.id },
            data: { status: 'SUSPENDED' },
          });
          await request(app.getHttpServer())
            .get('/api/auth/me')
            .auth(token, { type: 'bearer' })
            .expect(401);
        }
        await disconnected;
        expect(socket.connected).toBe(false);
      } finally {
        socket.close();
      }
    }
  });
});
