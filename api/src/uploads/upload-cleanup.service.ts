import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readdir, unlink } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { lockMedia, savedUploadReferences } from './upload-references';

const HOUR = 3_600_000;
const LEASE_MS = 5 * 60_000;
const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const missing = (error: unknown) =>
  (error as NodeJS.ErrnoException).code === 'ENOENT';

@Injectable()
export class UploadCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UploadCleanupService.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private stopping = false;
  readonly root: string;
  readonly settings: {
    enabled: boolean;
    intervalHours: number;
    graceHours: number;
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.root = resolve(config.getOrThrow<string>('UPLOAD_DIR'));
    this.settings = {
      enabled: config.get<boolean>('UPLOAD_CLEANUP_ENABLED') ?? true,
      intervalHours: config.get<number>('UPLOAD_CLEANUP_INTERVAL_HOURS') ?? 1,
      graceHours: config.get<number>('UPLOAD_CLEANUP_GRACE_HOURS') ?? 24,
    };
  }

  get origin() {
    return new URL(this.config.getOrThrow<string>('PUBLIC_BASE_URL')).origin;
  }

  onModuleInit() {
    if (!this.settings.enabled) return;
    this.timer = setInterval(() => {
      void this.start('scheduled').catch((error: unknown) => {
        if (!(error instanceof ConflictException))
          this.logger.error(message(error));
      });
    }, this.settings.intervalHours * HOUR);
    this.timer.unref();
  }

  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }

  /** Validate every ancestor: never traverse a symlink, even inside the upload root. */
  async safeFile(path: string) {
    const target = resolve(this.root, path);
    if (
      !path ||
      !target.startsWith(this.root + sep) ||
      path.includes('\\') ||
      path.split('/').some((p) => !p || p === '.' || p === '..')
    )
      throw new Error('Unsafe upload path');
    let current = this.root;
    const rootStat = await lstat(current);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory())
      throw new Error('Upload root must be a real directory');
    const parts = path.split('/');
    for (let index = 0; index < parts.length; index++) {
      current = join(current, parts[index]);
      const stat = await lstat(current);
      if (stat.isSymbolicLink())
        throw new Error('Symbolic links are excluded from cleanup');
      if (index < parts.length - 1 && !stat.isDirectory())
        throw new Error('Invalid upload directory');
      if (index === parts.length - 1) {
        if (!stat.isFile())
          throw new Error('Only regular files can be cleaned');
        return { target, size: stat.size };
      }
    }
    throw new Error('Invalid upload path');
  }

  private async inventory() {
    await mkdir(this.root, { recursive: true });
    const rootStat = await lstat(this.root);
    if (rootStat.isSymbolicLink())
      throw new Error('Upload root must not be a symbolic link');
    const files: { path: string; size: number }[] = [];
    const walk = async (directory: string) => {
      for (const entry of await readdir(join(this.root, directory), {
        withFileTypes: true,
      })) {
        if (entry.isSymbolicLink()) continue;
        const path = directory ? `${directory}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(path);
        else if (entry.isFile()) {
          try {
            files.push({ path, size: (await this.safeFile(path)).size });
          } catch (error) {
            if (!missing(error)) throw error;
          }
        }
      }
    };
    await walk('');
    return files;
  }

  async register(path: string, size: number) {
    await this.prisma.mediaWrite(async (tx) => {
      await tx.uploadAsset.create({
        data: { path, size, unreferencedAt: new Date() },
      });
    });
  }

  /** Preview may discover files and reset reference clocks, but never deletes files. */
  async reconcile(now = new Date()) {
    const files = await this.inventory();
    await this.prisma.$transaction(
      async (tx) => {
        await lockMedia(tx);
        const references = await savedUploadReferences(tx, this.origin);
        for (const file of files) {
          const existing = await tx.uploadAsset.findUnique({
            where: { path: file.path },
          });
          if (existing && existing.state !== 'ACTIVE') continue;
          await tx.uploadAsset.upsert({
            where: { path: file.path },
            create: {
              ...file,
              unreferencedAt: references.has(file.path) ? null : now,
            },
            update: {
              size: file.size,
              unreferencedAt: references.has(file.path)
                ? null
                : (existing?.unreferencedAt ?? now),
            },
          });
        }
        // Also reconcile registered missing files; deletion later treats ENOENT as success.
        const active = await tx.uploadAsset.findMany({
          where: { state: 'ACTIVE' },
        });
        for (const asset of active) {
          const since = references.has(asset.path)
            ? null
            : (asset.unreferencedAt ?? now);
          if (since?.getTime() !== asset.unreferencedAt?.getTime())
            await tx.uploadAsset.update({
              where: { path: asset.path },
              data: { unreferencedAt: since },
            });
        }
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  async preview(page = 1, limit = 20) {
    await this.reconcile();
    await this.prisma.$transaction(
      async (tx) => {
        await lockMedia(tx);
        const lease = await tx.uploadMaintenance.findUniqueOrThrow({
          where: { id: 1 },
        });
        if (
          lease.leaseOwner &&
          lease.leaseUntil &&
          lease.leaseUntil <= new Date()
        ) {
          await tx.uploadCleanupRun.updateMany({
            where: { id: lease.leaseOwner, status: 'RUNNING' },
            data: {
              status: 'FAILED',
              finishedAt: new Date(),
              error: 'Cleanup lease expired; interrupted work will be retried.',
            },
          });
          await tx.uploadMaintenance.update({
            where: { id: 1 },
            data: { leaseOwner: null, leaseUntil: null },
          });
        }
      },
      { maxWait: 10000, timeout: 30000 },
    );
    const cutoff = new Date(Date.now() - this.settings.graceHours * HOUR);
    const where = { state: { not: 'DELETED' }, unreferencedAt: { not: null } };
    const [assets, total, eligible, lastRun, totals] = await Promise.all([
      this.prisma.uploadAsset.findMany({
        where,
        orderBy: [{ unreferencedAt: 'asc' }, { path: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.uploadAsset.count({ where }),
      this.prisma.uploadAsset.aggregate({
        where: {
          ...where,
          OR: [{ state: 'DELETING' }, { unreferencedAt: { lte: cutoff } }],
        },
        _count: true,
        _sum: { size: true },
      }),
      this.prisma.uploadCleanupRun.findFirst({
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.uploadAsset.aggregate({ where, _sum: { size: true } }),
    ]);
    return {
      items: assets.map((a) => ({
        path: a.path,
        size: a.size,
        state: a.state,
        unreferencedAt: a.unreferencedAt!,
        eligibleAt: new Date(
          a.unreferencedAt!.getTime() + this.settings.graceHours * HOUR,
        ),
        eligible: a.state === 'DELETING' || a.unreferencedAt! <= cutoff,
        error: a.error,
      })),
      total,
      page,
      limit,
      orphanBytes: totals._sum.size ?? 0,
      eligibleCount: eligible._count,
      reclaimableBytes: eligible._sum.size ?? 0,
      settings: this.settings,
      lastRun: lastRun
        ? { ...lastRun, deletedBytes: Number(lastRun.deletedBytes) }
        : null,
    };
  }

  async start(trigger: 'scheduled' | 'manual', actorId?: string) {
    if (this.stopping) throw new ConflictException('Server is shutting down');
    const id = randomUUID();
    await this.prisma.$transaction(
      async (tx) => {
        await lockMedia(tx);
        const lease = await tx.uploadMaintenance.findUniqueOrThrow({
          where: { id: 1 },
        });
        const now = new Date();
        if (lease.leaseUntil && lease.leaseUntil > now)
          throw new ConflictException('Upload cleanup is already running');
        await tx.uploadCleanupRun.updateMany({
          where: { status: 'RUNNING' },
          data: {
            status: 'FAILED',
            finishedAt: now,
            error: 'Cleanup lease expired; interrupted work will be retried.',
          },
        });
        await tx.uploadCleanupRun.create({ data: { id, trigger, actorId } });
        await tx.uploadMaintenance.update({
          where: { id: 1 },
          data: {
            leaseOwner: id,
            leaseUntil: new Date(now.getTime() + LEASE_MS),
          },
        });
      },
      { maxWait: 10000, timeout: 30000 },
    );
    this.running = this.execute(id).catch((error) =>
      this.logger.error(message(error)),
    );
    return { id };
  }

  private async execute(id: string) {
    try {
      await this.reconcile();
      const cutoff = new Date(Date.now() - this.settings.graceHours * HOUR);
      let after = '';
      while (!this.stopping) {
        const batch = await this.prisma.$transaction(
          async (tx) => {
            await lockMedia(tx);
            const lease = await tx.uploadMaintenance.findUniqueOrThrow({
              where: { id: 1 },
            });
            if (lease.leaseOwner !== id) throw new Error('Cleanup lease lost');
            await tx.uploadMaintenance.update({
              where: { id: 1 },
              data: { leaseUntil: new Date(Date.now() + LEASE_MS) },
            });
            const refs = await savedUploadReferences(tx, this.origin);
            const assets = await tx.uploadAsset.findMany({
              where: {
                path: { gt: after },
                OR: [
                  { state: 'DELETING' },
                  { state: 'ACTIVE', unreferencedAt: { lte: cutoff } },
                ],
              },
              orderBy: { path: 'asc' },
              take: 100,
            });
            for (const asset of assets) {
              await tx.uploadAsset.update({
                where: { path: asset.path },
                data: refs.has(asset.path)
                  ? { state: 'ACTIVE', unreferencedAt: null, error: null }
                  : { state: 'DELETING' },
              });
            }
            return assets.filter((a) => !refs.has(a.path));
          },
          { maxWait: 10000, timeout: 30000 },
        );
        // A protected batch can be empty; advance using a separate bounded candidate query.
        if (!batch.length) {
          const next = await this.prisma.uploadAsset.findFirst({
            where: {
              path: { gt: after },
              OR: [
                { state: 'DELETING' },
                { state: 'ACTIVE', unreferencedAt: { lte: cutoff } },
              ],
            },
            orderBy: { path: 'asc' },
          });
          if (!next) break;
          continue;
        }
        after = batch[batch.length - 1].path;
        for (const asset of batch) {
          if (this.stopping) break;
          await this.deleteClaimed(id, asset.path);
        }
      }
      await this.prisma.uploadCleanupRun.update({
        where: { id },
        data: {
          status: this.stopping ? 'FAILED' : 'COMPLETED',
          finishedAt: new Date(),
          ...(this.stopping
            ? { error: 'Server stopped; claimed files will be retried.' }
            : {}),
        },
      });
    } catch (error) {
      await this.prisma.uploadCleanupRun.update({
        where: { id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          error: message(error),
        },
      });
      this.logger.error(`Upload cleanup ${id}: ${message(error)}`);
    } finally {
      await this.prisma.uploadMaintenance.updateMany({
        where: { id: 1, leaseOwner: id },
        data: { leaseOwner: null, leaseUntil: null },
      });
    }
  }

  private async deleteClaimed(id: string, path: string) {
    // Keep the writer lock during unlink so a lease takeover or content save cannot race it.
    await this.prisma.$transaction(
      async (tx) => {
        await lockMedia(tx);
        const lease = await tx.uploadMaintenance.findUniqueOrThrow({
          where: { id: 1 },
        });
        if (lease.leaseOwner !== id) throw new Error('Cleanup lease lost');
        await tx.uploadMaintenance.update({
          where: { id: 1 },
          data: { leaseUntil: new Date(Date.now() + LEASE_MS) },
        });
        const asset = await tx.uploadAsset.findUniqueOrThrow({
          where: { path },
        });
        if (asset.state !== 'DELETING') return;
        if ((await savedUploadReferences(tx, this.origin)).has(path)) {
          await tx.uploadAsset.update({
            where: { path },
            data: { state: 'ACTIVE', unreferencedAt: null },
          });
          return;
        }
        try {
          const file = await this.safeFile(path);
          await unlink(file.target);
        } catch (error) {
          if (!missing(error)) {
            await tx.uploadAsset.update({
              where: { path },
              data: { error: message(error) },
            });
            await tx.uploadCleanupRun.update({
              where: { id },
              data: { failedCount: { increment: 1 } },
            });
            return;
          }
        }
        await tx.uploadAsset.update({
          where: { path },
          data: { state: 'DELETED', error: null },
        });
        await tx.uploadCleanupRun.update({
          where: { id },
          data: {
            deletedCount: { increment: 1 },
            deletedBytes: { increment: asset.size },
          },
        });
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }
}
