import { BadRequestException } from '@nestjs/common';
import { authorSelect, presentContent } from '../common/media';
import { Injectable, NotFoundException } from '@nestjs/common';
import { paginate } from '../common/utils';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findAll(page = 1, limit = 20, q?: string) {
    const { skip, take } = paginate(page, limit);
    const where = q
      ? {
          OR: [
            { title: { contains: q } },
            { description: { contains: q } },
            { location: { contains: q } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        skip,
        take,
        orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
        include: {
          createdBy: {
            select: authorSelect,
          },
        },
      }),
      this.prisma.event.count({ where }),
    ]);
    return { items: items.map(presentContent), total, page, limit: take };
  }

  async findOne(id: string) {
    const item = await this.prisma.event.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: authorSelect,
        },
      },
    });
    if (!item) throw new NotFoundException('Event not found');
    return presentContent(item);
  }

  private validateDates(start: string | Date, end: string | Date) {
    if (new Date(end) < new Date(start))
      throw new BadRequestException('Event end must not precede its start');
  }

  async create(dto: CreateEventDto, createdById: string) {
    this.validateDates(dto.startAt, dto.endAt);
    const item = await this.notifications.createWithNotification(
      (tx) =>
        tx.event.create({
          data: {
            title: dto.title,
            description: dto.description,
            startAt: new Date(dto.startAt),
            endAt: new Date(dto.endAt),
            location: dto.location,
            coverImageUrl: dto.coverImageUrl,
            createdById,
          },
          include: {
            createdBy: {
              select: authorSelect,
            },
          },
        }),
      (item) => ({
        audience: 'GLOBAL' as const,
        type: 'event.created',
        title: 'New event',
        body: item.title,
        resourceType: 'event',
        resourceId: item.id,
      }),
    );
    return presentContent(item);
  }

  async update(id: string, dto: UpdateEventDto) {
    const existing = await this.findOne(id);
    this.validateDates(
      dto.startAt ?? existing.startAt,
      dto.endAt ?? existing.endAt,
    );
    return this.prisma.event
      .update({
        where: { id },
        data: {
          ...dto,
          ...(dto.startAt ? { startAt: new Date(dto.startAt) } : {}),
          ...(dto.endAt ? { endAt: new Date(dto.endAt) } : {}),
        },
        include: {
          createdBy: {
            select: authorSelect,
          },
        },
      })
      .then(presentContent);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.event.delete({ where: { id } });
    return { ok: true };
  }
}
