import { createHash } from 'node:crypto';
import { PrismaClient, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  blogContent,
  commentContent,
  forumContent,
  images,
  newsContent,
} from './seed-content';

// Stable, valid UUIDs also work with the comment API's parentId validation.
export function demoId(key: string): string {
  const hash = createHash('sha256')
    .update(`teamorbit-demo-v1:${key}`)
    .digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

const accounts = [
  {
    username: 'superadmin',
    fullName: 'Super Admin',
    email: 'super@teamorbit.local',
    role: Role.SUPERUSER,
    status: UserStatus.ACTIVE,
  },
  {
    username: 'admin',
    fullName: 'Team Admin',
    email: 'admin@teamorbit.local',
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
  },
  {
    username: 'member',
    fullName: 'Team Member',
    email: 'user@teamorbit.local',
    role: Role.USER,
    status: UserStatus.ACTIVE,
  },
  {
    username: 'maya',
    fullName: 'Maya Chen',
    email: 'maya@teamorbit.local',
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
  },
  {
    username: 'noah',
    fullName: 'Noah Silva',
    email: 'noah@teamorbit.local',
    role: Role.USER,
    status: UserStatus.ACTIVE,
  },
  {
    username: 'lina',
    fullName: 'Lina Haddad',
    email: null,
    role: Role.USER,
    status: UserStatus.ACTIVE,
  },
  {
    username: 'alex',
    fullName: 'Alex Rivera',
    email: 'alex@teamorbit.local',
    role: Role.USER,
    status: UserStatus.ACTIVE,
  },
  {
    username: 'yuki',
    fullName: 'Yuki Tanaka',
    email: null,
    role: Role.USER,
    status: UserStatus.PENDING,
  },
  {
    username: 'sam',
    fullName: 'Sam Okafor',
    email: 'sam@teamorbit.local',
    role: Role.USER,
    status: UserStatus.INACTIVE,
  },
  {
    username: 'priya',
    fullName: 'Priya Shah',
    email: 'priya@teamorbit.local',
    role: Role.USER,
    status: UserStatus.SUSPENDED,
  },
  {
    username: 'robin',
    fullName: 'Robin Park',
    email: null,
    role: Role.USER,
    status: UserStatus.DELETED,
  },
  {
    username: 'elena',
    fullName: 'Elena Rossi',
    email: 'elena@teamorbit.local',
    role: Role.USER,
    status: UserStatus.PENDING,
  },
];

const events = [
  {
    title: 'Orbit kickoff and workspace tour',
    description:
      'A friendly walkthrough of news, events, and discussions. Bring one question about your team workflow.',
    day: -21,
    hours: 1,
    location: 'Shanghai · Studio A',
    coverImageUrl: images.orbit,
  },
  {
    title: 'Documentation sprint retrospective',
    description:
      'Review the onboarding refresh and pick the next three improvements. Notes will be shared after the session.',
    day: -7,
    hours: 1.5,
    location: 'Online · Team room',
    coverImageUrl: null,
  },
  {
    title: 'API clinic: from request to typed client',
    description:
      'Pair on a small API integration and leave with a runnable TypeScript example. All experience levels welcome.',
    day: 2,
    hours: 2,
    location: 'Online · Engineering room',
    coverImageUrl: images.workshop,
  },
  {
    title: 'Accessible design roundtable',
    description:
      'Discuss image descriptions, keyboard navigation, and readable tables. Please bring a small interface to review.',
    day: 5,
    hours: 1,
    location: 'Lisbon · Meeting room 2',
    coverImageUrl: null,
  },
  {
    title: 'Metrics notebook workshop',
    description:
      'Compare averages, medians, and sample sizes using fictional team activity data.',
    day: 10,
    hours: 2,
    location: 'Online · Learning room',
    coverImageUrl: images.metrics,
  },
  {
    title: 'Community demo afternoon',
    description:
      'Share a five-minute demo and one lesson learned. Watch remotely or join the local gathering.',
    day: 18,
    hours: 3,
    location: 'Shanghai · Common space',
    coverImageUrl: images.workshop,
  },
];

const announcements = [
  [
    'Welcome to the Orbit demo',
    'This workspace contains fictional examples for exploring team workflows. Start with News, Blog, and Forum for rich Markdown content.',
  ],
  [
    'Profile review week',
    'Check your display name and optional email in Settings. New members remain pending until an administrator activates their account.',
  ],
  [
    'Workshop hosts wanted',
    'Volunteer to host a small learning session. Share a topic, a preferred format, and the artifact participants will take away.',
  ],
  [
    'Demo maintenance rehearsal',
    'The operations team is rehearsing its release checklist using sample data. This announcement does not indicate real downtime.',
  ],
  [
    'A reminder about image descriptions',
    'Use useful alt text for meaningful images. A short description of the information is usually more helpful than a visual inventory.',
  ],
  [
    'Share your first small win',
    'Introduce yourself in the forum and share something you learned this week. Short posts and beginner questions are welcome. 👋',
  ],
];

type Summary = Record<string, { created: number; skipped: number }>;

export async function seedDatabase(
  prisma: PrismaClient,
  now = new Date(),
  publicBaseUrl = process.env.PUBLIC_BASE_URL || '',
): Promise<Summary> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo fixtures cannot be seeded in production.');
  const baseUrl = new URL(publicBaseUrl);
  if (
    !['http:', 'https:'].includes(baseUrl.protocol) ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new Error(
      'PUBLIC_BASE_URL must be an HTTP(S) API URL without a query or fragment',
    );
  }
  const markdown = (content: string) =>
    content.replaceAll('](/uploads/demo/', `](${baseUrl.origin}/uploads/demo/`);
  const passwordHash = await bcrypt.hash('password123', 10);
  const summary: Summary = {};
  const date = (days: number, hours = 0) =>
    new Date(now.getTime() + (days * 24 + hours) * 3_600_000);

  // All records and derived scores commit together. A failed seed leaves no partial dataset.
  await prisma.$transaction(
    async (tx) => {
      async function missing<T>(
        model: string,
        find: () => Promise<T | null>,
        create: () => Promise<T>,
      ) {
        const existing = await find();
        const counts = (summary[model] ??= { created: 0, skipped: 0 });
        if (existing) {
          counts.skipped++;
          return { item: existing, created: false };
        }
        const item = await create();
        counts.created++;
        return { item, created: true };
      }

      const users: { id: string }[] = [];
      for (const [index, account] of accounts.entries()) {
        const result = await missing(
          'User',
          () =>
            tx.user.findFirst({
              where: {
                OR: [
                  { id: demoId(`user:${account.username}`) },
                  { username: account.username },
                  ...(account.email ? [{ email: account.email }] : []),
                ],
              },
            }),
          () =>
            tx.user.create({
              data: {
                id: demoId(`user:${account.username}`),
                ...account,
                passwordHash,
                avatarUrl: index % 3 === 0 ? images.orbit : null,
                createdAt: date(-60 + index),
              },
            }),
        );
        users.push(result.item);
      }
      const author = (index: number) => users[[0, 1, 3][index % 3]].id;
      const participant = (index: number) => users[index % 7].id;

      for (const [index, event] of events.entries()) {
        const id = demoId(`event:${index}`);
        const { day, hours, ...data } = event;
        const createdById = author(index);
        const selected = index >= 4;
        const inviteeIds = selected
          ? [...new Set([createdById, participant(index + 1), participant(index + 2)])]
          : [];
        await missing(
          'Event',
          () => tx.event.findUnique({ where: { id } }),
          () =>
            tx.event.create({
              data: {
                id,
                ...data,
                audience: selected ? 'SELECTED' : 'GLOBAL',
                createdById,
                createdAt: date(-28 + index),
                startAt: date(day),
                endAt: date(day, hours),
                ...(selected
                  ? {
                      recipients: {
                        create: inviteeIds.map((userId) => ({ userId })),
                      },
                    }
                  : {}),
              },
            }),
        );
      }
      for (const [index, [title, description]] of announcements.entries()) {
        const id = demoId(`announcement:${index}`);
        await missing(
          'Announcement',
          () => tx.announcement.findUnique({ where: { id } }),
          () =>
            tx.announcement.create({
              data: {
                id,
                title,
                description,
                authorId: author(index),
                createdAt: date(-12 + index),
              },
            }),
        );
      }
      for (const [index, article] of newsContent.entries()) {
        const id = demoId(`news:${index}`);
        await missing(
          'News',
          () => tx.news.findUnique({ where: { id } }),
          () =>
            tx.news.create({
              data: {
                ...article,
                content: markdown(article.content),
                id,
                tags: {
                  connectOrCreate: article.tags.map((name) => ({
                    where: { name },
                    create: { name },
                  })),
                },
                authorId: author(index),
                coverImageUrl:
                  index % 2 === 0 ? Object.values(images)[index % 3] : null,
                createdAt: date(-16 + index),
              },
            }),
        );
      }
      for (const [index, article] of blogContent.entries()) {
        const id = demoId(`blog:${index}`);
        await missing(
          'BlogPost',
          () => tx.blogPost.findUnique({ where: { id } }),
          () =>
            tx.blogPost.create({
              data: {
                ...article,
                content: markdown(article.content),
                id,
                tags: {
                  connectOrCreate: article.tags.map((name) => ({
                    where: { name },
                    create: { name },
                  })),
                },
                authorId: author(index + 1),
                coverImageUrl:
                  index % 2 === 0 ? Object.values(images)[index % 3] : null,
                createdAt: date(-14 + index),
              },
            }),
        );
      }

      for (const [index, post] of forumContent.entries()) {
        const id = demoId(`forum:${index}`);
        const result = await missing(
          'ForumPost',
          () => tx.forumPost.findUnique({ where: { id } }),
          () =>
            tx.forumPost.create({
              data: {
                ...post,
                content: markdown(post.content),
                id,
                authorId: participant(index + 2),
                createdAt: date(-10 + index),
              },
            }),
        );
        // Votes belong to freshly created targets only: reruns preserve voting and score edits.
        summary.ForumPostVote ??= { created: 0, skipped: 0 };
        if (result.created) {
          const votes = [1, 1, index % 3 === 0 ? -1 : 1];
          for (const [voter, value] of votes.entries()) {
            await tx.forumPostVote.create({
              data: {
                id: demoId(`post-vote:${index}:${voter}`),
                postId: id,
                userId: participant(index + voter + 3),
                value,
                createdAt: date(-10 + index, 1),
              },
            });
          }
          summary.ForumPostVote.created += votes.length;
          await tx.forumPost.update({
            where: { id },
            data: { score: votes.reduce((a, b) => a + b, 0) },
          });
        } else {
          summary.ForumPostVote.skipped += 3;
        }
        for (const [commentIndex, content] of commentContent[index].entries()) {
          const commentId = demoId(`comment:${index}:${commentIndex}`);
          const comment = await missing(
            'Comment',
            () => tx.comment.findUnique({ where: { id: commentId } }),
            () =>
              tx.comment.create({
                data: {
                  id: commentId,
                  resourceType: 'forum',
                  resourceId: id,
                  content: markdown(content),
                  authorId: participant(index + commentIndex + 3),
                  parentId:
                    commentIndex === 2 ? demoId(`comment:${index}:0`) : null,
                  createdAt: date(-10 + index, 2 + commentIndex),
                },
              }),
          );
          summary.CommentVote ??= { created: 0, skipped: 0 };
          if (comment.created) {
            const votes = [1, commentIndex === 1 ? -1 : 1];
            for (const [voter, value] of votes.entries()) {
              await tx.commentVote.create({
                data: {
                  id: demoId(`comment-vote:${index}:${commentIndex}:${voter}`),
                  commentId,
                  userId: participant(index + commentIndex + voter + 4),
                  value,
                  createdAt: date(-10 + index, 5),
                },
              });
            }
            summary.CommentVote.created += votes.length;
            await tx.comment.update({
              where: { id: commentId },
              data: { score: votes.reduce((a, b) => a + b, 0) },
            });
          } else {
            summary.CommentVote.skipped += 2;
          }
        }
      }

      const resources = [
        ...events.slice(0, 2).map((event, index) => ({
          resourceType: 'event',
          resourceId: demoId(`event:${index}`),
          title: event.title,
        })),
        ...announcements.slice(0, 2).map(([title], index) => ({
          resourceType: 'announcement',
          resourceId: demoId(`announcement:${index}`),
          title,
        })),
        ...newsContent.slice(0, 4).map(({ title }, index) => ({
          resourceType: 'news',
          resourceId: demoId(`news:${index}`),
          title,
        })),
        ...blogContent.slice(0, 4).map(({ title }, index) => ({
          resourceType: 'blog',
          resourceId: demoId(`blog:${index}`),
          title,
        })),
        ...forumContent.slice(0, 4).map(({ title }, index) => ({
          resourceType: 'forum',
          resourceId: demoId(`forum:${index}`),
          title,
        })),
      ];
      for (const [index, resource] of resources.entries()) {
        const id = demoId(`notification:${index}`);
        await missing(
          'Notification',
          () => tx.notification.findUnique({ where: { id } }),
          () =>
            tx.notification.create({
              data: {
                id,
                audience: 'GLOBAL',
                resourceType: resource.resourceType,
                resourceId: resource.resourceId,
                type: `${resource.resourceType}.created`,
                title: `New ${resource.resourceType === 'forum' ? 'forum post' : resource.resourceType}`,
                body: resource.title,
                createdAt: date(-5, index),
              },
            }),
        );
        // Each primary demo account has 8 read and 8 unread sample notifications.
        for (let reader = 0; reader < 3; reader++) {
          if ((index + reader) % 2 !== 0) continue;
          const userId = users[reader].id;
          await missing(
            'NotificationRead',
            () =>
              tx.notificationRead.findUnique({
                where: {
                  userId_notificationId: { userId, notificationId: id },
                },
              }),
            () =>
              tx.notificationRead.create({
                data: {
                  id: demoId(`read:${index}:${reader}`),
                  userId,
                  notificationId: id,
                  readAt: date(-4, index),
                },
              }),
          );
        }
      }
    },
    { timeout: 30_000 },
  );
  return summary;
}
