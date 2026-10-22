import { Module } from '@nestjs/common';
import { ArticlesModule } from '../common/articles.module';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';

@Module({
  imports: [ArticlesModule],
  controllers: [BlogController],
  providers: [BlogService],
})
export class BlogModule {}