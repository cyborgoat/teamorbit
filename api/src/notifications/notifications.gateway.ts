type Socket = BaseSocket<
  { 'notification:new': (notification: Notification) => void },
  { 'notification:new': (notification: Notification) => void },
  { 'notification:new': (notification: Notification) => void },
  { userId?: string; expiresAt?: number }
>;
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Namespace, Socket as BaseSocket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ActiveUserService } from '../auth/active-user.service';
import { NotificationAudience, type Notification } from '@prisma/client';

@WebSocketGateway({ cors: { origin: true, credentials: true }, namespace: '/' })
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);
  private readonly checks = new Map<string, ReturnType<typeof setInterval>>();
  @WebSocketServer() server: Namespace<
    { 'notification:new': (notification: Notification) => void },
    { 'notification:new': (notification: Notification) => void },
    { 'notification:new': (notification: Notification) => void },
    { userId?: string; expiresAt?: number }
  >;
  constructor(
    private jwt: JwtService,
    private users: ActiveUserService,
  ) {}
  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const token = String(
        client.handshake.auth?.token ||
          client.handshake.headers.authorization?.replace('Bearer ', '') ||
          '',
      );
      const payload = await this.jwt.verifyAsync<{ sub: string; exp: number }>(
        token,
      );
      if (!(await this.users.find(payload.sub)))
        return void client.disconnect();
      if (!client.connected) return;
      client.data.userId = payload.sub;
      client.data.expiresAt = payload.exp * 1000;
      await client.join('authenticated');
      await client.join(`user:${payload.sub}`);
      const check = setInterval(() => {
        void this.authorized(client)
          .then((ok) => {
            if (!ok) client.disconnect();
          })
          .catch(() => client.disconnect());
      }, 1000);
      check.unref();
      this.checks.set(client.id, check);
    } catch {
      client.disconnect();
    }
  }
  handleDisconnect(client: Socket) {
    clearInterval(this.checks.get(client.id));
    this.checks.delete(client.id);
  }
  private async authorized(client: Socket) {
    return (
      Date.now() < Number(client.data.expiresAt) &&
      !!(await this.users.find(String(client.data.userId)))
    );
  }
  async broadcastNew(
    notification: Notification,
    recipientIds: string[] = [],
  ) {
    if (!this.server) return;
    if (notification.audience === NotificationAudience.DIRECTED) {
      for (const userId of recipientIds) {
        this.server.to(`user:${userId}`).emit('notification:new', notification);
      }
      return;
    }
    const clients = this.server.sockets;
    for (const client of clients.values()) {
      if (!client.rooms.has('authenticated')) continue;
      try {
        if (await this.authorized(client))
          client.emit('notification:new', notification);
        else client.disconnect();
      } catch (error) {
        this.logger.warn(`Notification delivery failed: ${String(error)}`);
      }
    }
  }
}
