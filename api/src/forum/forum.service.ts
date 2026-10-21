import { globalCreatedNotification } from '../common/content-crud';
import { assertCanModerate, type Actor } from '../common/policies';
import { authorSelect, presentContent, presentUser } from '../common/media';
import { Injectable, NotFoundException } from '@nestjs/common';
import { paginate } from '../common/utils';
import { CommentsService } from '../comments/comments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateForumPostDto,
  UpdateForumPostDto,
  VoteDto,
} from './dto/forum.dto';

@Injectable()
export class ForumService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private comments: CommentsService,
  ) {}

  async findAll(page = 1, limit = 20, q?: string) {
    const { skip, take } = paginate(page, limit);
    const where = q
      ? {
          OR: [{ title: { contains: q } }, { content: { contains: q } }],
        }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.forumPost.findMany({
        where,
        skip,
        take,
        orderBy: [{ score: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        include: {
          author: { select: authorSelect },
        },
      }),
      this.prisma.forumPost.count({ where }),
    ]);
    const counts = await Promise.all(
      rows.map((row) => this.comments.countForResource('forum', row.id)),
    );
    const items = rows.map((item, index) => ({
      ...presentContent(item),
      commentCount: counts[index],
    }));
    return { items, total, page, limit: take };
  }

  async findOne(id: string, userId: string) {
    // updateMany avoids bumping @updatedAt while recording a view.
    const updated = await this.prisma.forumPost.updateMany({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
    if (updated.count === 0)
      throw new NotFoundException('Forum post not found');
    const post = await this.prisma.forumPost.findUnique({
      where: { id },
      include: {
        author: { select: authorSelect },
        votes: { where: { userId }, select: { value: true } },
      },
    });
    const { items: comments } = await this.comments.listForResource(
      'forum',
      id,
      userId,
    );
    const { votes, ...rest } = post!;
    return {
      ...rest,
      author: presentUser(rest.author),
      myVote: votes[0]?.value ?? 0,
      comments,
    };
  }

  async create(dto: CreateForumPostDto, authorId: string) {
    const item = await this.notifications.createWithNotification(
      (tx) =>
        tx.forumPost.create({
          data: {
            title: dto.title,
            content: dto.content,
            authorId,
          },
          include: { author: { select: authorSelect } },
        }),
      (item) =>
        globalCreatedNotification({
          type: 'forum.created',
          title: 'New forum post',
          body: item.title,
          resourceType: 'forum',
          resourceId: item.id,
        }),
    );
    return { ...presentContent(item), commentCount: 0, myVote: 0 };
  }

  async update(id: string, dto: UpdateForumPostDto, actor: Actor) {
    const existing = await this.prisma.forumPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Forum post not found');
    assertCanModerate(actor, existing.authorId);
    return this.prisma
      .mediaWrite((tx) =>
        tx.forumPost.update({
          where: { id },
          data: {
            ...(dto.title !== undefined ? { title: dto.title } : {}),
            ...(dto.content !== undefined ? { content: dto.content } : {}),
          },
          include: { author: { select: authorSelect } },
        }),
      )
      .then(presentContent);
  }

  async remove(id: string, actor: Actor) {
    const existing = await this.prisma.forumPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Forum post not found');
    assertCanModerate(actor, existing.authorId);
    await this.prisma.$transaction([
      this.prisma.comment.deleteMany({
        where: { resourceType: 'forum', resourceId: id },
      }),
      this.prisma.forumPost.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  async votePost(postId: string, userId: string, dto: VoteDto) {
    const value = dto.value;
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.forumPost.findUnique({ where: { id: postId } });
      if (!target) throw new NotFoundException('Vote target not found');
      const votes = await tx.forumPostVote.findMany({
        where: { postId, userId },
      });
      const delta = value - (votes[0]?.value ?? 0);
      if (value === 0) {
        await tx.forumPostVote.deleteMany({ where: { postId, userId } });
      } else {
        await tx.forumPostVote.upsert({
          where: { userId_postId: { userId, postId } },
          create: { userId, postId, value },
          update: { value },
        });
      }
      const updated = await tx.forumPost.update({
        where: { id: postId },
        data: { score: { increment: delta } },
      });
      return { score: updated.score, myVote: value };
    });
  }
}
