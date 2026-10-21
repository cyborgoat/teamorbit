import { Module } from '@nestjs/common';
import { ArticleService } from '../common/article-service';
import { NotificationsModule } from '../notifications/notifications.module';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';

@Module({
  imports: [NotificationsModule],
  controllers: [NewsController],
  providers: [NewsService, ArticleService],
})
export class NewsModule {}
