import { ConfigService } from '@nestjs/config';
import { execFileSync } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
} from 'node:fs/promises';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { UploadCleanupService } from './upload-cleanup.service';
import * as references from './upload-references';

const HOUR = 3_600_000;
describe('upload cleanup lifecycle (isolated SQLite and files)', () => {
  let directory: string;
  let root: string;
  let prisma: PrismaService;
  let service: UploadCleanupService;
  let authorId: string;
  let originalOrigin: string | undefined;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'orbit-cleanup-'));
    root = join(directory, 'uploads');
    const url = `file:${join(directory, 'test.db')}`;
    execFileSync(
      process.execPath,
      [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
      { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' },
    );
    prisma = new PrismaService({ datasources: { db: { url } } });
    originalOrigin = process.env.PUBLIC_BASE_URL;
    process.env.PUBLIC_BASE_URL = 'https://orbit.example';
    service = new UploadCleanupService(
      prisma,
      new ConfigService({
        UPLOAD_DIR: root,
        PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
        UPLOAD_CLEANUP_ENABLED: false,
      }),
    );
  });
  beforeEach(async () => {
    jest.restoreAllMocks();
    await prisma.comment.deleteMany();
    await prisma.news.deleteMany();
    await prisma.event.deleteMany();
    await prisma.announcement.deleteMany();
    await prisma.blogPost.deleteMany();
    await prisma.forumPost.deleteMany();
    await prisma.user.deleteMany();
    await prisma.uploadAsset.deleteMany();
    await prisma.uploadCleanupRun.deleteMany();
    await prisma.uploadMaintenance.deleteMany();
    await rm(root, { recursive: true, force: true });
    await mkdir(root, { recursive: true });
    authorId = (
      await prisma.user.create({
        data: {
          username: 'author',
          fullName: 'Author',
          passwordHash: 'unused',
          status: 'DELETED',
        },
      })
    ).id;
  });
  afterAll(async () => {
    await service.onModuleDestroy();
    await prisma.$disconnect();
    await rm(directory, { recursive: true, force: true });
    if (originalOrigin === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = originalOrigin;
  });
  async function file(path: string) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), 'image');
  }
  async function age(path: string, hours = 25) {
    await prisma.uploadAsset.update({
      where: { path },
      data: { unreferencedAt: new Date(Date.now() - hours * HOUR) },
    });
  }
  async function run() {
    const { id } = await service.start('manual', authorId);
    for (let n = 0; n < 500; n++) {
      const result = await prisma.uploadCleanupRun.findUniqueOrThrow({
        where: { id },
      });
      const lease = await prisma.uploadMaintenance.findUnique({
        where: { id: 1 },
      });
      if (result.status !== 'RUNNING' && !lease?.leaseOwner) return result;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw Error('Cleanup timed out');
  }

  it('waits a full interval before the first scheduled run and clears the timer on shutdown', async () => {
    jest.useFakeTimers();
    const scheduled = new UploadCleanupService(
      prisma,
      new ConfigService({
        UPLOAD_DIR: root,
        PUBLIC_BASE_URL: 'https://orbit.example',
        UPLOAD_CLEANUP_ENABLED: true,
      }),
    );
    const start = jest
      .spyOn(scheduled, 'start')
      .mockResolvedValue({ id: 'scheduled-test' });
    try {
      scheduled.onModuleInit();
      jest.advanceTimersByTime(HOUR - 1);
      expect(start).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(start).toHaveBeenCalledWith('scheduled');
      await scheduled.onModuleDestroy();
      jest.advanceTimersByTime(HOUR);
      expect(start).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('requires the full grace period down to the boundary', async () => {
    await file('boundary.png');
    await service.reconcile();
    const now = Date.now();
    await prisma.uploadAsset.update({
      where: { path: 'boundary.png' },
      data: { unreferencedAt: new Date(now - 24 * HOUR + 1) },
    });
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
    expect((await service.preview()).eligibleCount).toBe(0);
    clock.mockReturnValue(now + 1);
    expect((await service.preview()).eligibleCount).toBe(1);
    clock.mockRestore();
  });

  it('imports existing nested files with a fresh grace period, then deletes only eligible files', async () => {
    await file('demo/old.svg');
    await file('recent.png');
    const preview = await service.preview();
    expect(preview.total).toBe(2);
    expect(preview.eligibleCount).toBe(0);
    await age('demo/old.svg');
    const result = await run();
    expect(result).toMatchObject({
      status: 'COMPLETED',
      deletedCount: 1,
      deletedBytes: 5n,
      actorId: authorId,
    });
    await expect(readFile(join(root, 'demo/old.svg'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await readFile(join(root, 'recent.png'), 'utf8')).toBe('image');
  });

  it('keeps shared images, deleted-user avatars, covers, reference links, and replies until their last reference disappears', async () => {
    for (const p of ['shared.png', 'avatar.png', 'cover.png', 'reply.png'])
      await file(p);
    await prisma.mediaWrite(async (tx) => {
      await tx.user.update({
        where: { id: authorId },
        data: { avatarUrl: '/uploads/avatar.png' },
      });
      const post = await tx.news.create({
        data: {
          title: 'News',
          content: '![a](/uploads/shared.png)',
          coverImageUrl: 'https://orbit.example/uploads/cover.png',
          authorId,
        },
      });
      await tx.blogPost.create({
        data: {
          title: 'Blog',
          content: '[asset][ref]\n[ref]: /uploads/shared.png',
          authorId,
        },
      });
      const comment = await tx.comment.create({
        data: {
          content: 'parent',
          resourceType: 'news',
          resourceId: post.id,
          authorId,
        },
      });
      await tx.comment.create({
        data: {
          content: '![reply](/uploads/reply.png)',
          parentId: comment.id,
          resourceType: 'news',
          resourceId: post.id,
          authorId,
        },
      });
    });
    expect((await service.preview()).total).toBe(0);
    await prisma.news.deleteMany(); // Simulate remaining shared references after one owner disappears.
    await service.reconcile();
    expect(
      (
        await prisma.uploadAsset.findUniqueOrThrow({
          where: { path: 'shared.png' },
        })
      ).unreferencedAt,
    ).toBeNull();
    await prisma.blogPost.deleteMany();
    await prisma.comment.deleteMany();
    await service.reconcile();
    expect((await service.preview()).total).toBe(3);
    expect((await run()).deletedCount).toBe(0);
  });

  it('resets the full grace period when a file is reattached and removed again between sweeps', async () => {
    await file('draft.png');
    await service.reconcile();
    await age('draft.png');
    const post = await prisma.mediaWrite((tx) =>
      tx.news.create({
        data: { title: 'n', content: '/uploads/draft.png', authorId },
      }),
    );
    expect(
      (
        await prisma.uploadAsset.findUniqueOrThrow({
          where: { path: 'draft.png' },
        })
      ).unreferencedAt,
    ).toBeNull();
    await prisma.news.delete({ where: { id: post.id } });
    expect((await service.preview()).eligibleCount).toBe(0);
  });

  it('rejects attachments to claimed/deleted files, retries failures, and completes already-missing files', async () => {
    await file('retry.png');
    await service.reconcile();
    await age('retry.png');
    await prisma.uploadAsset.update({
      where: { path: 'retry.png' },
      data: { state: 'DELETING' },
    });
    await expect(
      prisma.mediaWrite((tx) =>
        tx.news.create({
          data: { title: 'n', content: '/uploads/retry.png', authorId },
        }),
      ),
    ).rejects.toThrow('removed by upload cleanup');
    expect(await prisma.news.count()).toBe(0);
    jest
      .spyOn(fs, 'unlink')
      .mockRejectedValueOnce(
        Object.assign(new Error('permission denied'), { code: 'EACCES' }),
      );
    expect((await run()).failedCount).toBe(1);
    expect(
      (
        await prisma.uploadAsset.findUniqueOrThrow({
          where: { path: 'retry.png' },
        })
      ).state,
    ).toBe('DELETING');
    jest.restoreAllMocks();
    await rm(join(root, 'retry.png'));
    expect((await run()).deletedCount).toBe(1);
  });

  it('refuses overlapping runs and recovers an expired run lease and claimed files', async () => {
    await file('interrupted.png');
    await service.reconcile();
    await age('interrupted.png');
    await prisma.uploadAsset.update({
      where: { path: 'interrupted.png' },
      data: { state: 'DELETING' },
    });
    await prisma.uploadCleanupRun.create({
      data: { id: 'old-run', trigger: 'scheduled' },
    });
    await prisma.uploadMaintenance.update({
      where: { id: 1 },
      data: { leaseOwner: 'old-run', leaseUntil: new Date(Date.now() + HOUR) },
    });
    await expect(service.start('manual', authorId)).rejects.toThrow(
      'already running',
    );
    await prisma.uploadMaintenance.update({
      where: { id: 1 },
      data: { leaseUntil: new Date(0) },
    });
    expect((await run()).deletedCount).toBe(1);
    expect(
      (
        await prisma.uploadCleanupRun.findUniqueOrThrow({
          where: { id: 'old-run' },
        })
      ).status,
    ).toBe('FAILED');
  });

  it('skips symlinks, rejects traversal, and never touches their targets', async () => {
    const outside = join(directory, 'outside.png');
    await writeFile(outside, 'keep');
    await symlink(outside, join(root, 'link.png'));
    expect((await service.preview()).total).toBe(0);
    await expect(service.safeFile('../outside.png')).rejects.toThrow('Unsafe');
    await expect(service.safeFile('link.png')).rejects.toThrow('Symbolic');
    expect(await readFile(outside, 'utf8')).toBe('keep');
  });

  it('does not delete anything if reference scanning fails', async () => {
    await file('safe.png');
    await service.reconcile();
    await age('safe.png');
    jest
      .spyOn(references, 'savedUploadReferences')
      .mockRejectedValueOnce(new Error('database unavailable'));
    expect((await run()).status).toBe('FAILED');
    expect(await readFile(join(root, 'safe.png'), 'utf8')).toBe('image');
  });

  it('uses the database lock to reject a save racing a claimed deletion', async () => {
    await file('race.png');
    await service.reconcile();
    await age('race.png');
    const original = fs.unlink;
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const deleting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    jest.spyOn(fs, 'unlink').mockImplementationOnce(async (path) => {
      entered();
      await gate;
      await original(path);
    });
    await service.start('manual', authorId);
    await deleting;
    const save = prisma.mediaWrite((tx) =>
      tx.news.create({
        data: { title: 'race', content: '/uploads/race.png', authorId },
      }),
    );
    const rejection = expect(save).rejects.toThrow('removed by upload cleanup');
    release();
    await rejection;
    for (
      let n = 0;
      n < 500 &&
      (await prisma.uploadMaintenance.findUnique({ where: { id: 1 } }))
        ?.leaseOwner;
      n++
    )
      await new Promise((resolve) => setTimeout(resolve, 10));
    expect(await prisma.news.count()).toBe(0);
  });
});
