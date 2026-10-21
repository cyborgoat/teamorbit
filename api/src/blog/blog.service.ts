import { Injectable, NotFoundException } from '@nestjs/common';
import { paginate } from '../common/utils';
import { authorSelect, presentContent } from '../common/media';
import { tagWrite } from '../common/tags';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlogPostDto, UpdateBlogPostDto } from './dto/blog.dto';

@Injectable()
export class BlogService {
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
      this.prisma.blogPost.findMany({
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
      this.prisma.blogPost.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.map(r)),
      total,
      page,
      limit: take,
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.blogPost.findUnique({
      where: { id },
      include: {
        tags: true,
        author: {
          select: authorSelect,
        },
      },
    });
    if (!item) throw new NotFoundException('Blog post not found');
    return this.map(item);
  }

  async create(dto: CreateBlogPostDto, authorId: string) {
    const item = await this.notifications.createWithNotification(
      (tx) =>
        tx.blogPost.create({
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
        type: 'blog.created',
        title: 'New blog post',
        body: item.title,
        resourceType: 'blog',
        resourceId: item.id,
      }),
    );
    return this.map(item);
  }

  async update(id: string, dto: UpdateBlogPostDto) {
    await this.findOne(id);
    const item = await this.prisma.blogPost.update({
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
    await this.prisma.blogPost.delete({ where: { id } });
    return { ok: true };
  }
}
