import { Injectable, NotFoundException } from '@nestjs/common';
import { paginate } from '../common/utils';
import { authorSelect, presentContent } from '../common/media';
import { tagWrite } from '../common/tags';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNewsDto, UpdateNewsDto } from './dto/news.dto';

@Injectable()
export class NewsService {
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

  async findAll(page = 1, limit = 20, q?: string, tag?: string) {
    const { skip, take } = paginate(page, limit);
    const where = {
      ...(q
        ? {
            OR: [{ title: { contains: q } }, { content: { contains: q } }],
          }
        : {}),
      ...(tag ? { tags: { some: { name: tag } } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.news.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          tags: true,
          author: {
            select: authorSelect,
          },
        },
      }),
      this.prisma.news.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.map(r)),
      total,
      page,
      limit: take,
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.news.findUnique({
      where: { id },
      include: {
        tags: true,
        author: {
          select: authorSelect,
        },
      },
    });
    if (!item) throw new NotFoundException('News not found');
    return this.map(item);
  }

  async create(dto: CreateNewsDto, authorId: string) {
    const item = await this.notifications.createWithNotification(
      (tx) =>
        tx.news.create({
          data: {
            title: dto.title,
            content: dto.content,
            tags: tagWrite(dto.tags),
            coverImageUrl: dto.coverImageUrl,
            authorId,
          },
          include: {
            tags: true,
            author: {
              select: authorSelect,
            },
          },
        }),
      (item) => ({
        audience: 'GLOBAL' as const,
        type: 'news.created',
        title: 'New news article',
        body: item.title,
        resourceType: 'news',
        resourceId: item.id,
      }),
    );
    return this.map(item);
  }

  async update(id: string, dto: UpdateNewsDto) {
    await this.findOne(id);
    const item = await this.prisma.news.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        coverImageUrl: dto.coverImageUrl,
        ...(dto.tags !== undefined
          ? { tags: { set: [], ...tagWrite(dto.tags) } }
          : {}),
      },
      include: {
        tags: true,
        author: {
          select: authorSelect,
        },
      },
    });
    return this.map(item);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.news.delete({ where: { id } });
    return { ok: true };
  }
}
