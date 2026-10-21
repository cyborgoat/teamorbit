import { Injectable } from '@nestjs/common';
import { ArticleService } from '../common/article-service';
import { CreateNewsDto, UpdateNewsDto } from './dto/news.dto';

@Injectable()
export class NewsService {
  constructor(private articles: ArticleService) {}

  findAll(page = 1, limit = 20, q?: string, tag?: string) {
    return this.articles.findAll('news', page, limit, q, tag);
  }

  findOne(id: string) {
    return this.articles.findOne('news', id);
  }

  create(dto: CreateNewsDto, authorId: string) {
    return this.articles.create('news', dto, authorId);
  }

  update(id: string, dto: UpdateNewsDto) {
    return this.articles.update('news', id, dto);
  }

  remove(id: string) {
    return this.articles.remove('news', id);
  }
}
