import { Injectable, NotFoundException } from '@nestjs/common';
import { paginate } from './utils';
import { authorSelect, presentContent } from './media';
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
    const item =
      kind === 'news'
        ? await this.prisma.news.findUnique({ where: { id }, include })
        : await this.prisma.blogPost.findUnique({ where: { id }, include });
    if (!item) throw new NotFoundException(config[kind].notFound);
    return this.map(item);
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
  ) {
    await this.findOne(kind, id);
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
        ? await this.prisma.news.update({ where: { id }, data, include })
        : await this.prisma.blogPost.update({ where: { id }, data, include });
    return this.map(item);
  }

  async remove(kind: ArticleKind, id: string) {
    await this.findOne(kind, id);
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
