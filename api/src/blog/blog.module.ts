import { Module } from '@nestjs/common';
import { ArticleService } from '../common/article-service';
import { NotificationsModule } from '../notifications/notifications.module';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';

@Module({
  imports: [NotificationsModule],
  controllers: [BlogController],
  providers: [BlogService, ArticleService],
})
export class BlogModule {}
