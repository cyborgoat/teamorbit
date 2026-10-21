import { assertCanModerate, type Actor } from '../common/policies';
import { authorSelect, presentContent, presentUser } from '../common/media';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ContentRefService,
  type CommentResourceType,
} from './content-ref.service';
import {
  CreateCommentDto,
  UpdateCommentDto,
  VoteDto,
} from './dto/comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private contentRef: ContentRefService,
  ) {}

  async listForResource(
    resourceType: CommentResourceType,
    resourceId: string,
    userId: string,
  ) {
    await this.contentRef.resolve(resourceType, resourceId);
    const comments = await this.prisma.comment.findMany({
      where: { resourceType, resourceId, parentId: null },
      orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
      include: {
        author: { select: authorSelect },
        votes: { where: { userId }, select: { value: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: authorSelect },
            votes: { where: { userId }, select: { value: true } },
          },
        },
      },
    });
    return { items: comments.map((c) => this.mapComment(c)) };
  }

  async countForResource(
    resourceType: CommentResourceType,
    resourceId: string,
  ) {
    return this.prisma.comment.count({ where: { resourceType, resourceId } });
  }

  async create(dto: CreateCommentDto, authorId: string) {
    const content = await this.contentRef.resolve(
      dto.resourceType,
      dto.resourceId,
    );

    let parentAuthorId: string | undefined;
    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
      });
      if (
        !parent ||
        parent.resourceType !== dto.resourceType ||
        parent.resourceId !== dto.resourceId
      ) {
        throw new BadRequestException('Invalid parent comment');
      }
      if (parent.parentId) {
        throw new BadRequestException('Only one level of replies is allowed');
      }
      parentAuthorId = parent.authorId;
    }

    const targetUserId = dto.parentId ? parentAuthorId! : content.ownerId;

    const comment = await this.notifications.createWithNotification(
      (tx) =>
        tx.comment.create({
          data: {
            content: dto.content,
            resourceType: dto.resourceType,
            resourceId: dto.resourceId,
            authorId,
            parentId: dto.parentId,
          },
          include: { author: { select: authorSelect } },
        }),
      () =>
        targetUserId === authorId
          ? null
          : {
              audience: 'DIRECTED' as const,
              type: `${dto.resourceType}.comment.created`,
              title: 'New comment',
              body: content.title,
              resourceType: dto.resourceType,
              resourceId: dto.resourceId,
              recipientIds: [targetUserId],
            },
    );

    return {
      ...presentContent(comment),
      myVote: 0,
      replies: [] as [],
    };
  }

  async update(id: string, dto: UpdateCommentDto, actor: Actor) {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Comment not found');
    assertCanModerate(actor, existing.authorId);
    return this.prisma.comment
      .update({
        where: { id },
        data: { content: dto.content },
        include: { author: { select: authorSelect } },
      })
      .then(presentContent);
  }

  async remove(id: string, actor: Actor) {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Comment not found');
    assertCanModerate(actor, existing.authorId);
    await this.prisma.comment.delete({ where: { id } });
    return { ok: true as const };
  }

  async vote(commentId: string, userId: string, dto: VoteDto) {
    const value = dto.value;
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.comment.findUnique({ where: { id: commentId } });
      if (!target) throw new NotFoundException('Vote target not found');
      const votes = await tx.commentVote.findMany({
        where: { commentId, userId },
      });
      const delta = value - (votes[0]?.value ?? 0);
      if (value === 0) {
        await tx.commentVote.deleteMany({ where: { commentId, userId } });
      } else {
        await tx.commentVote.upsert({
          where: { userId_commentId: { userId, commentId } },
          create: { userId, commentId, value },
          update: { value },
        });
      }
      const updated = await tx.comment.update({
        where: { id: commentId },
        data: { score: { increment: delta } },
      });
      return { score: updated.score, myVote: value };
    });
  }

  private mapComment(comment: {
    id: string;
    content: string;
    score: number;
    resourceType: string;
    resourceId: string;
    authorId: string;
    parentId: string | null;
    createdAt: Date;
    updatedAt: Date;
    author: {
      id: string;
      username: string;
      fullName: string;
      avatarUrl: string | null;
    };
    votes: { value: number }[];
    replies?: {
      id: string;
      content: string;
      score: number;
      resourceType: string;
      resourceId: string;
      authorId: string;
      parentId: string | null;
      createdAt: Date;
      updatedAt: Date;
      author: {
        id: string;
        username: string;
        fullName: string;
        avatarUrl: string | null;
      };
      votes: { value: number }[];
    }[];
  }) {
    const { votes, replies, ...rest } = comment;
    return {
      ...rest,
      author: presentUser(rest.author),
      myVote: votes[0]?.value ?? 0,
      replies: (replies ?? []).map((r) => {
        const { votes: replyVotes, ...replyRest } = r;
        return {
          ...replyRest,
          author: presentUser(replyRest.author),
          myVote: replyVotes[0]?.value ?? 0,
        };
      }),
    };
  }
}
