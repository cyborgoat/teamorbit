import { assertCanModerate, type Actor } from '../common/policies';
import { authorSelect, presentContent, presentUser } from '../common/media';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginate } from '../common/utils';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateForumCommentDto,
  CreateForumPostDto,
  UpdateForumCommentDto,
  UpdateForumPostDto,
  VoteDto,
} from './dto/forum.dto';

@Injectable()
export class ForumService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
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
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.forumPost.count({ where }),
    ]);
    const items = rows.map(({ _count, ...item }) => ({
      ...presentContent(item),
      commentCount: _count.comments,
    }));
    return { items, total, page, limit: take };
  }

  async findOne(id: string, userId: string) {
    const post = await this.prisma.forumPost.findUnique({
      where: { id },
      include: {
        author: { select: authorSelect },
        votes: { where: { userId }, select: { value: true } },
        comments: {
          where: { parentId: null },
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
        },
      },
    });
    if (!post) throw new NotFoundException('Forum post not found');

    const mapComment = (comment: {
      id: string;
      content: string;
      score: number;
      postId: string;
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
        postId: string;
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
    }) => {
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
    };

    const { votes, comments, ...rest } = post;
    return {
      ...rest,
      author: presentUser(rest.author),
      myVote: votes[0]?.value ?? 0,
      comments: comments.map((c) => mapComment(c)),
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
      (item) => ({
        audience: 'GLOBAL' as const,
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
    return this.prisma.forumPost
      .update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.content !== undefined ? { content: dto.content } : {}),
        },
        include: { author: { select: authorSelect } },
      })
      .then(presentContent);
  }

  async remove(id: string, actor: Actor) {
    const existing = await this.prisma.forumPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Forum post not found');
    assertCanModerate(actor, existing.authorId);
    await this.prisma.forumPost.delete({ where: { id } });
    return { ok: true };
  }

  async createComment(
    postId: string,
    dto: CreateForumCommentDto,
    authorId: string,
  ) {
    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Forum post not found');

    let parentAuthorId: string | undefined;
    if (dto.parentId) {
      const parent = await this.prisma.forumComment.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent || parent.postId !== postId) {
        throw new BadRequestException('Invalid parent comment');
      }
      if (parent.parentId) {
        throw new BadRequestException('Only one level of replies is allowed');
      }
      parentAuthorId = parent.authorId;
    }

    const targetUserId = dto.parentId ? parentAuthorId! : post.authorId;

    const comment = await this.notifications.createWithNotification(
      (tx) =>
        tx.forumComment.create({
          data: {
            content: dto.content,
            postId,
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
              type: 'forum.comment.created',
              title: 'New forum comment',
              body: post.title,
              resourceType: 'forum',
              resourceId: postId,
              recipientIds: [targetUserId],
            },
    );

    return { ...presentContent(comment), myVote: 0, replies: [] };
  }

  async updateComment(id: string, dto: UpdateForumCommentDto, actor: Actor) {
    const existing = await this.prisma.forumComment.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Comment not found');
    assertCanModerate(actor, existing.authorId);
    return this.prisma.forumComment
      .update({
        where: { id },
        data: { content: dto.content },
        include: { author: { select: authorSelect } },
      })
      .then(presentContent);
  }

  async removeComment(id: string, actor: Actor) {
    const existing = await this.prisma.forumComment.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Comment not found');
    assertCanModerate(actor, existing.authorId);
    await this.prisma.forumComment.delete({ where: { id } });
    return { ok: true };
  }

  async votePost(postId: string, userId: string, dto: VoteDto) {
    return this.vote('post', postId, userId, dto.value);
  }
  async voteComment(commentId: string, userId: string, dto: VoteDto) {
    return this.vote('comment', commentId, userId, dto.value);
  }
  private async vote(
    kind: 'post' | 'comment',
    id: string,
    userId: string,
    value: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const target =
        kind === 'post'
          ? await tx.forumPost.findUnique({ where: { id } })
          : await tx.forumComment.findUnique({ where: { id } });
      if (!target) throw new NotFoundException('Vote target not found');
      const votes =
        kind === 'post'
          ? await tx.forumPostVote.findMany({ where: { postId: id, userId } })
          : await tx.forumCommentVote.findMany({
              where: { commentId: id, userId },
            });
      const delta = value - (votes[0]?.value ?? 0);
      if (kind === 'post') {
        if (value === 0)
          await tx.forumPostVote.deleteMany({ where: { postId: id, userId } });
        else
          await tx.forumPostVote.upsert({
            where: { userId_postId: { userId, postId: id } },
            create: { userId, postId: id, value },
            update: { value },
          });
        const updated = await tx.forumPost.update({
          where: { id },
          data: { score: { increment: delta } },
        });
        return { score: updated.score, myVote: value };
      }
      if (value === 0)
        await tx.forumCommentVote.deleteMany({
          where: { commentId: id, userId },
        });
      else
        await tx.forumCommentVote.upsert({
          where: { userId_commentId: { userId, commentId: id } },
          create: { userId, commentId: id, value },
          update: { value },
        });
      const updated = await tx.forumComment.update({
        where: { id },
        data: { score: { increment: delta } },
      });
      return { score: updated.score, myVote: value };
    });
  }
}
