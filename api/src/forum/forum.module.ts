import { Module } from '@nestjs/common';
import { CommentsModule } from '../comments/comments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';

@Module({
  imports: [NotificationsModule, CommentsModule],
  controllers: [ForumController],
  providers: [ForumService],
})
export class ForumModule {}
