import { globalCreatedNotification } from '../common/content-crud';
import { authorSelect, presentContent } from '../common/media';
import { Injectable, NotFoundException } from '@nestjs/common';
import { paginate } from '../common/utils';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findAll(page = 1, limit = 20, q?: string) {
    const { skip, take } = paginate(page, limit);
    const where = q
      ? {
          OR: [{ title: { contains: q } }, { description: { contains: q } }],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          author: {
            select: authorSelect,
          },
        },
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return { items: items.map(presentContent), total, page, limit: take };
  }

  async findOne(id: string) {
    const item = await this.prisma.announcement.findUnique({
      where: { id },
      include: {
        author: {
          select: authorSelect,
        },
      },
    });
    if (!item) throw new NotFoundException('Announcement not found');
    return presentContent(item);
  }

  async create(dto: CreateAnnouncementDto, authorId: string) {
    const item = await this.notifications.createWithNotification(
      (tx) =>
        tx.announcement.create({
          data: { ...dto, authorId },
          include: {
            author: {
              select: authorSelect,
            },
          },
        }),
      (item) =>
        globalCreatedNotification({
          type: 'announcement.created',
          title: 'New announcement',
          body: item.title,
          resourceType: 'announcement',
          resourceId: item.id,
        }),
    );
    return presentContent(item);
  }

  async update(id: string, dto: UpdateAnnouncementDto) {
    await this.findOne(id);
    return this.prisma
      .mediaWrite((tx) =>
        tx.announcement.update({
          where: { id },
          data: dto,
          include: {
            author: {
              select: authorSelect,
            },
          },
        }),
      )
      .then(presentContent);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.$transaction([
      this.prisma.comment.deleteMany({
        where: { resourceType: 'announcement', resourceId: id },
      }),
      this.prisma.announcement.delete({ where: { id } }),
    ]);
    return { ok: true };
  }
}
