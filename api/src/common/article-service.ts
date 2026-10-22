import { Injectable, NotFoundException } from '@nestjs/common';
import { paginate } from './utils';
import { authorSelect, presentContent } from './media';
import { assertCanModerate, type Actor } from './policies';
import { tagWrite } from './tags';
import { globalCreatedNotification } from './content-crud';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

type ArticleKind = 'news' | 'blog';

const config = {
  news: {
    notFound: 'News not found',
    notifyType: 'news.created',
    notifyTitle: 'New news article',
    resourceType: 'news',
  },
  blog: {
    notFound: 'Blog post not found',
    notifyType: 'blog.created',
    notifyTitle: 'New blog post',
    resourceType: 'blog',
  },
} as const;

@Injectable()
export class ArticleService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private map<
    T extends {
      tags: { name: string }[];
      author: {
        id: string;
        username: string;
        fullName: string;
        avatarUrl: string | null;
      };
      coverImageUrl: string | null;
    },
  >(item: T) {
    return presentContent({ ...item, tags: item.tags.map((tag) => tag.name) });
  }

  async findAll(
    kind: ArticleKind,
    page = 1,
    limit = 20,
    q?: string,
    tag?: string,
  ) {
    const { skip, take } = paginate(page, limit);
    const where = {
      ...(q
        ? {
            OR: [{ title: { contains: q } }, { content: { contains: q } }],
          }
        : {}),
      ...(tag ? { tags: { some: { name: tag } } } : {}),
    };
    const include = {
      tags: true,
      author: { select: authorSelect },
    } as const;
    const [rows, total] =
      kind === 'news'
        ? await Promise.all([
            this.prisma.news.findMany({
              where,
              skip,
              take,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              include,
            }),
            this.prisma.news.count({ where }),
          ])
        : await Promise.all([
            this.prisma.blogPost.findMany({
              where,
              skip,
              take,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              include,
            }),
            this.prisma.blogPost.count({ where }),
          ]);
    return {
      items: rows.map((r) => this.map(r)),
      total,
      page,
      limit: take,
    };
  }

  async findOne(kind: ArticleKind, id: string) {
    const include = {
      tags: true,
      author: { select: authorSelect },
    } as const;
    // updateMany avoids bumping @updatedAt while recording a view.
    const updated =
      kind === 'news'
        ? await this.prisma.news.updateMany({
            where: { id },
            data: { viewCount: { increment: 1 } },
          })
        : await this.prisma.blogPost.updateMany({
            where: { id },
            data: { viewCount: { increment: 1 } },
          });
    if (updated.count === 0)
      throw new NotFoundException(config[kind].notFound);
    const item =
      kind === 'news'
        ? await this.prisma.news.findUnique({ where: { id }, include })
        : await this.prisma.blogPost.findUnique({ where: { id }, include });
    return this.map(item!);
  }

  async create(
    kind: ArticleKind,
    dto: {
      title: string;
      content: string;
      tags?: string[];
      coverImageUrl?: string | null;
    },
    authorId: string,
  ) {
    const meta = config[kind];
    const item = await this.notifications.createWithNotification(
      (tx) => {
        const data = {
          title: dto.title,
          content: dto.content,
          tags: tagWrite(dto.tags),
          coverImageUrl: dto.coverImageUrl,
          authorId,
        };
        const include = {
          tags: true,
          author: { select: authorSelect },
        };
        return kind === 'news'
          ? tx.news.create({ data, include })
          : tx.blogPost.create({ data, include });
      },
      (created) =>
        globalCreatedNotification({
          type: meta.notifyType,
          title: meta.notifyTitle,
          body: created.title,
          resourceType: meta.resourceType,
          resourceId: created.id,
        }),
    );
    return this.map(item);
  }

  async update(
    kind: ArticleKind,
    id: string,
    dto: {
      title?: string;
      content?: string;
      tags?: string[];
      coverImageUrl?: string | null;
    },
    actor: Actor,
  ) {
    const existing =
      kind === 'news'
        ? await this.prisma.news.findUnique({
            where: { id },
            select: { authorId: true },
          })
        : await this.prisma.blogPost.findUnique({
            where: { id },
            select: { authorId: true },
          });
    if (!existing) throw new NotFoundException(config[kind].notFound);
    assertCanModerate(actor, existing.authorId);
    const data = {
      title: dto.title,
      content: dto.content,
      coverImageUrl: dto.coverImageUrl,
      ...(dto.tags !== undefined
        ? { tags: { set: [], ...tagWrite(dto.tags) } }
        : {}),
    };
    const include = {
      tags: true,
      author: { select: authorSelect },
    };
    const item =
      kind === 'news'
        ? await this.prisma.mediaWrite((tx) =>
            tx.news.update({ where: { id }, data, include }),
          )
        : await this.prisma.mediaWrite((tx) =>
            tx.blogPost.update({ where: { id }, data, include }),
          );
    return this.map(item);
  }

  async remove(kind: ArticleKind, id: string, actor: Actor) {
    const existing =
      kind === 'news'
        ? await this.prisma.news.findUnique({
            where: { id },
            select: { authorId: true },
          })
        : await this.prisma.blogPost.findUnique({
            where: { id },
            select: { authorId: true },
          });
    if (!existing) throw new NotFoundException(config[kind].notFound);
    assertCanModerate(actor, existing.authorId);
    if (kind === 'news') {
      await this.prisma.$transaction([
        this.prisma.comment.deleteMany({
          where: { resourceType: 'news', resourceId: id },
        }),
        this.prisma.news.delete({ where: { id } }),
      ]);
    } else {
      await this.prisma.$transaction([
        this.prisma.comment.deleteMany({
          where: { resourceType: 'blog', resourceId: id },
        }),
        this.prisma.blogPost.delete({ where: { id } }),
      ]);
    }
    return { ok: true as const };
  }
}
