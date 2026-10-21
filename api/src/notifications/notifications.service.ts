import { NotificationAudience, Prisma } from '@prisma/client';
import { paginate } from '../common/utils';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

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

  async createWithNotification<T>(
    create: (tx: Prisma.TransactionClient) => Promise<T>,
    input: (item: T) => NotificationInput | null,
  ) {
    const { item, notification, recipientIds } = await this.prisma.$transaction(
      async (tx) => {
        const item = await create(tx);
        const payload = input(item);
        if (!payload) {
          return { item, notification: null, recipientIds: [] as string[] };
        }
        const recipientIds = [
          ...new Set(
            (payload.recipientIds ?? []).filter((id) => Boolean(id)),
          ),
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

  async listForUser(userId: string, page = 1, limit = 20) {
    const { skip, take } = paginate(page, limit);
    const where: Prisma.NotificationWhereInput = {
      OR: [
        { audience: NotificationAudience.GLOBAL },
        { recipients: { some: { userId } } },
      ],
    };
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
    return this.prisma.notificationRead.upsert({
      where: {
        userId_notificationId: { userId, notificationId },
      },
      create: { userId, notificationId },
      update: { readAt: new Date() },
    });
  }
}
