import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventAudience, NotificationAudience, Prisma } from '@prisma/client';
import { globalCreatedNotification } from '../common/content-crud';
import { authorSelect, presentContent, presentUser } from '../common/media';
import { assertCanModerate, type Actor } from '../common/policies';
import { Injectable } from '@nestjs/common';
import { paginate } from '../common/utils';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import { UserStatus } from '@prisma/client';

const eventInclude = {
  createdBy: { select: authorSelect },
  recipients: { include: { user: { select: authorSelect } } },
} satisfies Prisma.EventInclude;

type EventWithRelations = Prisma.EventGetPayload<{
  include: typeof eventInclude;
}>;

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private visibleWhere(userId: string): Prisma.EventWhereInput {
    return {
      OR: [
        { audience: EventAudience.GLOBAL },
        { recipients: { some: { userId } } },
      ],
    };
  }

  private presentEvent(item: EventWithRelations) {
    const { recipients, ...rest } = presentContent(item);
    return {
      ...rest,
      recipients:
        item.audience === EventAudience.INVITE_ONLY
          ? recipients.map((row) => presentUser(row.user))
          : [],
    };
  }

  private async resolveRecipientIds(
    recipientIds: string[] | undefined,
    creatorId: string,
  ) {
    const unique = [
      ...new Set([...(recipientIds ?? []), creatorId].filter(Boolean)),
    ];
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique }, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (users.length !== unique.length) {
      throw new BadRequestException(
        'One or more recipients are invalid or inactive',
      );
    }
    return unique;
  }

  async findAll(userId: string, page = 1, limit = 20, q?: string) {
    const { skip, take } = paginate(page, limit);
    const search = q
      ? {
          OR: [
            { title: { contains: q } },
            { description: { contains: q } },
            { location: { contains: q } },
          ],
        }
      : {};
    const where: Prisma.EventWhereInput = {
      AND: [this.visibleWhere(userId), search],
    };
    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        skip,
        take,
        orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
        include: eventInclude,
      }),
      this.prisma.event.count({ where }),
    ]);
    return {
      items: items.map((item) => this.presentEvent(item)),
      total,
      page,
      limit: take,
    };
  }

  async findOne(id: string, userId: string) {
    const item = await this.prisma.event.findFirst({
      where: { id, ...this.visibleWhere(userId) },
      include: eventInclude,
    });
    if (!item) throw new NotFoundException('Event not found');
    return this.presentEvent(item);
  }

  private validateDates(start: string | Date, end: string | Date) {
    if (new Date(end) < new Date(start))
      throw new BadRequestException('Event end must not precede its start');
  }

  async create(dto: CreateEventDto, createdById: string) {
    this.validateDates(dto.startAt, dto.endAt);
    const audience = dto.audience ?? EventAudience.GLOBAL;
    const recipientIds =
      audience === EventAudience.INVITE_ONLY
        ? await this.resolveRecipientIds(dto.recipientIds, createdById)
        : [];

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
            audience,
            createdById,
            ...(audience === EventAudience.INVITE_ONLY
              ? {
                  recipients: {
                    create: recipientIds.map((userId) => ({ userId })),
                  },
                }
              : {}),
          },
          include: eventInclude,
        }),
      (item) =>
        audience === EventAudience.GLOBAL
          ? globalCreatedNotification({
              type: 'event.created',
              title: 'New event',
              body: item.title,
              resourceType: 'event',
              resourceId: item.id,
            })
          : {
              audience: NotificationAudience.DIRECTED,
              type: 'event.created',
              title: 'New event',
              body: item.title,
              resourceType: 'event',
              resourceId: item.id,
              recipientIds,
            },
    );
    return this.presentEvent(item);
  }

  async update(id: string, dto: UpdateEventDto, actor: Actor) {
    const existingRow = await this.prisma.event.findUnique({
      where: { id },
      include: eventInclude,
    });
    if (!existingRow) throw new NotFoundException('Event not found');
    assertCanModerate(actor, existingRow.createdById);
    const existing = this.presentEvent(existingRow);
    this.validateDates(
      dto.startAt ?? existing.startAt,
      dto.endAt ?? existing.endAt,
    );

    const audience = dto.audience ?? existing.audience;
    const touchingAudience =
      dto.audience !== undefined || dto.recipientIds !== undefined;
    let recipientIds: string[] | undefined;
    if (touchingAudience) {
      recipientIds =
        audience === EventAudience.INVITE_ONLY
          ? await this.resolveRecipientIds(
              dto.recipientIds ?? existing.recipients.map((r) => r.id),
              existing.createdById,
            )
          : [];
    }

    const { audience: _a, recipientIds: _r, ...fields } = dto;
    const item = await this.prisma.mediaWrite(async (tx) => {
      if (touchingAudience) {
        await tx.eventRecipient.deleteMany({ where: { eventId: id } });
        if (audience === EventAudience.INVITE_ONLY && recipientIds?.length) {
          await tx.eventRecipient.createMany({
            data: recipientIds.map((recipientId) => ({
              eventId: id,
              userId: recipientId,
            })),
          });
        }
      }
      return tx.event.update({
        where: { id },
        data: {
          ...fields,
          audience: touchingAudience ? audience : undefined,
          ...(dto.startAt ? { startAt: new Date(dto.startAt) } : {}),
          ...(dto.endAt ? { endAt: new Date(dto.endAt) } : {}),
        },
        include: eventInclude,
      });
    });
    return this.presentEvent(item);
  }

  async remove(id: string, actor: Actor) {
    const existing = await this.prisma.event.findUnique({
      where: { id },
      select: { createdById: true },
    });
    if (!existing) throw new NotFoundException('Event not found');
    assertCanModerate(actor, existing.createdById);
    await this.prisma.$transaction([
      this.prisma.comment.deleteMany({
        where: { resourceType: 'event', resourceId: id },
      }),
      this.prisma.event.delete({ where: { id } }),
    ]);
    return { ok: true };
  }
}
