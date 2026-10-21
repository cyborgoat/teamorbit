import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { ContentRefService } from './content-ref.service';

@Module({
  imports: [NotificationsModule],
  controllers: [CommentsController],
  providers: [CommentsService, ContentRefService],
  exports: [CommentsService, ContentRefService],
})
export class CommentsModule {}
