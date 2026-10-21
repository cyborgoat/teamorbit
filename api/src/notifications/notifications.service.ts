import { NotificationAudience, Prisma } from '@prisma/client';
import { paginate } from '../common/utils';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationListStatus } from './dto/notification.dto';

export type NotificationInput = {
  audience: NotificationAudience;
  type: string;
  title: string;
  body: string;
  resourceType: string;
  resourceId: string;
  recipientIds?: string[];
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(
    private prisma: PrismaService,
    private gateway: NotificationsGateway,
  ) {}

  private audienceWhere(userId: string): Prisma.NotificationWhereInput {
    return {
      OR: [
        { audience: NotificationAudience.GLOBAL },
        { recipients: { some: { userId } } },
      ],
    };
  }

  private visibleWhere(userId: string): Prisma.NotificationWhereInput {
    return {
      AND: [this.audienceWhere(userId), { dismissals: { none: { userId } } }],
    };
  }

  private listWhere(
    userId: string,
    status?: NotificationListStatus,
  ): Prisma.NotificationWhereInput {
    if (status === NotificationListStatus.DISMISSED) {
      return {
        AND: [this.audienceWhere(userId), { dismissals: { some: { userId } } }],
      };
    }
    const inbox = this.visibleWhere(userId);
    if (status === NotificationListStatus.UNREAD) {
      return { AND: [inbox, { reads: { none: { userId } } }] };
    }
    if (status === NotificationListStatus.READ) {
      return { AND: [inbox, { reads: { some: { userId } } }] };
    }
    return inbox;
  }

  private async requireVisible(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, ...this.visibleWhere(userId) },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  private async requireAccessible(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, ...this.audienceWhere(userId) },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  async createWithNotification<T>(
    create: (tx: Prisma.TransactionClient) => Promise<T>,
    input: (item: T) => NotificationInput | null,
  ) {
    const { item, notification, recipientIds } = await this.prisma.mediaWrite(
      async (tx) => {
        const item = await create(tx);
        const payload = input(item);
        if (!payload) {
          return { item, notification: null, recipientIds: [] as string[] };
        }
        const recipientIds = [
          ...new Set((payload.recipientIds ?? []).filter((id) => Boolean(id))),
        ];
        if (
          payload.audience === NotificationAudience.DIRECTED &&
          recipientIds.length === 0
        ) {
          return { item, notification: null, recipientIds: [] as string[] };
        }
        const notification = await tx.notification.create({
          data: {
            audience: payload.audience,
            type: payload.type,
            title: payload.title,
            body: payload.body,
            resourceType: payload.resourceType,
            resourceId: payload.resourceId,
            ...(payload.audience === NotificationAudience.DIRECTED
              ? {
                  recipients: {
                    create: recipientIds.map((userId) => ({ userId })),
                  },
                }
              : {}),
          },
        });
        return { item, notification, recipientIds };
      },
    );
    if (notification) {
      try {
        await this.gateway.broadcastNew(notification, recipientIds);
      } catch {
        this.logger.warn(
          `Notification ${notification.id} persisted, but live delivery failed`,
        );
      }
    }
    return item;
  }

  async listForUser(
    userId: string,
    page = 1,
    limit = 20,
    status?: NotificationListStatus,
  ) {
    const { skip, take } = paginate(page, limit);
    const where = this.listWhere(userId, status);
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          reads: { where: { userId }, take: 1 },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      items: items.map((n) => ({
        id: n.id,
        audience: n.audience,
        type: n.type,
        title: n.title,
        body: n.body,
        resourceType: n.resourceType,
        resourceId: n.resourceId,
        createdAt: n.createdAt,
        read: n.reads.length > 0,
      })),
      total,
      page: Math.max(page, 1),
      limit: take,
    };
  }

  async markRead(userId: string, notificationId: string) {
    await this.requireVisible(userId, notificationId);
    return this.prisma.notificationRead.upsert({
      where: {
        userId_notificationId: { userId, notificationId },
      },
      create: { userId, notificationId },
      update: { readAt: new Date() },
    });
  }

  async markUnread(userId: string, notificationId: string) {
    await this.requireVisible(userId, notificationId);
    await this.prisma.notificationRead.deleteMany({
      where: { userId, notificationId },
    });
    return { ok: true as const };
  }

  async markAllRead(userId: string) {
    const unread = await this.prisma.notification.findMany({
      where: this.listWhere(userId, NotificationListStatus.UNREAD),
      select: { id: true },
    });
    if (unread.length === 0) {
      return { ok: true as const, marked: 0 };
    }
    const result = await this.prisma.notificationRead.createMany({
      data: unread.map((n) => ({ userId, notificationId: n.id })),
    });
    return { ok: true as const, marked: result.count };
  }

  async dismissForUser(userId: string, notificationId: string) {
    await this.requireVisible(userId, notificationId);
    await this.prisma.notificationDismissal.upsert({
      where: {
        userId_notificationId: { userId, notificationId },
      },
      create: { userId, notificationId },
      update: { dismissedAt: new Date() },
    });
    return { ok: true as const };
  }

  async restoreForUser(userId: string, notificationId: string) {
    await this.requireAccessible(userId, notificationId);
    const result = await this.prisma.notificationDismissal.deleteMany({
      where: { userId, notificationId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Notification not found');
    }
    return { ok: true as const };
  }
}
