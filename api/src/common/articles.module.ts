import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ArticleService } from './article-service';

@Module({
  imports: [NotificationsModule],
  providers: [ArticleService],
  exports: [ArticleService],
})
export class ArticlesModule {}
