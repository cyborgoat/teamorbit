import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const COMMENT_RESOURCE_TYPES = [
  'announcement',
  'event',
  'news',
  'blog',
  'forum',
] as const;

export type CommentResourceType = (typeof COMMENT_RESOURCE_TYPES)[number];

export type ContentRef = {
  resourceType: CommentResourceType;
  resourceId: string;
  ownerId: string;
  title: string;
};

@Injectable()
export class ContentRefService {
  constructor(private prisma: PrismaService) {}

  async resolve(
    resourceType: CommentResourceType,
    resourceId: string,
  ): Promise<ContentRef> {
    switch (resourceType) {
      case 'announcement': {
        const item = await this.prisma.announcement.findUnique({
          where: { id: resourceId },
        });
        if (!item) throw new NotFoundException('Announcement not found');
        return {
          resourceType,
          resourceId,
          ownerId: item.authorId,
          title: item.title,
        };
      }
      case 'event': {
        const item = await this.prisma.event.findUnique({
          where: { id: resourceId },
        });
        if (!item) throw new NotFoundException('Event not found');
        return {
          resourceType,
          resourceId,
          ownerId: item.createdById,
          title: item.title,
        };
      }
      case 'news': {
        const item = await this.prisma.news.findUnique({
          where: { id: resourceId },
        });
        if (!item) throw new NotFoundException('News not found');
        return {
          resourceType,
          resourceId,
          ownerId: item.authorId,
          title: item.title,
        };
      }
      case 'blog': {
        const item = await this.prisma.blogPost.findUnique({
          where: { id: resourceId },
        });
        if (!item) throw new NotFoundException('Blog post not found');
        return {
          resourceType,
          resourceId,
          ownerId: item.authorId,
          title: item.title,
        };
      }
      case 'forum': {
        const item = await this.prisma.forumPost.findUnique({
          where: { id: resourceId },
        });
        if (!item) throw new NotFoundException('Forum post not found');
        return {
          resourceType,
          resourceId,
          ownerId: item.authorId,
          title: item.title,
        };
      }
    }
  }
}
