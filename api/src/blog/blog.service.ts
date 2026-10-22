import { Injectable } from '@nestjs/common';
import { ArticleService } from '../common/article-service';
import type { Actor } from '../common/policies';
import { CreateBlogPostDto, UpdateBlogPostDto } from './dto/blog.dto';

@Injectable()
export class BlogService {
  constructor(private articles: ArticleService) {}

  findAll(page = 1, limit = 20, q?: string, tag?: string) {
    return this.articles.findAll('blog', page, limit, q, tag);
  }

  findOne(id: string) {
    return this.articles.findOne('blog', id);
  }

  create(dto: CreateBlogPostDto, authorId: string) {
    return this.articles.create('blog', dto, authorId);
  }

  update(id: string, dto: UpdateBlogPostDto, actor: Actor) {
    return this.articles.update('blog', id, dto, actor);
  }

  remove(id: string, actor: Actor) {
    return this.articles.remove('blog', id, actor);
  }
}
