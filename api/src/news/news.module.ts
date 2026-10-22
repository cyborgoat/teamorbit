import { Module } from '@nestjs/common';
import { ArticlesModule } from '../common/articles.module';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';

@Module({
  imports: [ArticlesModule],
  controllers: [NewsController],
  providers: [NewsService],
})
export class NewsModule {}
