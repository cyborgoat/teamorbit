import MarkdownIt from 'markdown-it';
import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

const markdown = new MarkdownIt({ html: false, linkify: false });

/** Only service-owned upload paths; decode once and reject traversal. */
export function uploadPath(input: string, origin: string): string | null {
  let value = input;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.origin !== origin) return null;
      value = url.pathname;
    } catch {
      return null;
    }
  }
  try {
    value = decodeURIComponent(value.split(/[?#]/)[0]);
  } catch {
    return null;
  }
  if (
    !value.startsWith('/uploads/') ||
    value.includes('\\') ||
    [...value].some((char) => char.charCodeAt(0) < 32)
  )
    return null;
  const parts = value.slice('/uploads/'.length).split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return null;
  return parts.join('/');
}

/** Conservative extraction also retains URLs mentioned in code or plain text. */
export function uploadReferences(text: string, origin: string): Set<string> {
  const paths = new Set<string>();
  const visit = (tokens: ReturnType<typeof markdown.parse>) => {
    for (const token of tokens) {
      for (const attr of ['src', 'href']) {
        const url = token.attrGet(attr);
        const path = typeof url === 'string' ? uploadPath(url, origin) : null;
        if (path) paths.add(path);
      }
      if (token.children) visit(token.children);
    }
  };
  visit(markdown.parse(text, {}));
  // Examine each occurrence rather than consuming a whole Markdown token. This
  // handles adjacent links and filenames containing brackets or parentheses.
  for (const match of text.matchAll(/\/uploads\//g)) {
    const index = match.index;
    const before = text
      .slice(0, index)
      .match(/https?:\/\/[^\s<>"'`()[\]]*$/i)?.[0];
    if (before) {
      try {
        if (new URL(before).origin !== origin) continue;
      } catch {
        continue;
      }
    }
    const token = text.slice(index).match(/^[^\s<>"'`]+/)?.[0] ?? '';
    const candidates = new Set([token]);
    for (let end = 1; end < token.length; end++) {
      if (/[()[\],.;!?}]/.test(token[end])) candidates.add(token.slice(0, end));
    }
    for (const candidate of candidates) {
      const path = uploadPath(candidate, origin);
      if (path) paths.add(path);
    }
  }
  return paths;
}

export async function savedUploadReferences(
  tx: Prisma.TransactionClient,
  origin: string,
) {
  const rows = await Promise.all([
    tx.user.findMany({ select: { avatarUrl: true } }),
    tx.event.findMany({ select: { description: true, coverImageUrl: true } }),
    tx.announcement.findMany({ select: { description: true } }),
    tx.news.findMany({ select: { content: true, coverImageUrl: true } }),
    tx.blogPost.findMany({ select: { content: true, coverImageUrl: true } }),
    tx.forumPost.findMany({ select: { content: true } }),
    tx.comment.findMany({ select: { content: true } }),
    // Retain links in saved notifications too, including user-authored bodies.
    tx.notification.findMany({ select: { body: true, title: true } }),
  ]);
  const references = new Set<string>();
  for (const row of rows.flat()) {
    for (const value of Object.values(row)) {
      if (typeof value !== 'string') continue;
      for (const path of uploadReferences(value, origin)) references.add(path);
      const direct = uploadPath(value, origin);
      if (direct) references.add(direct);
    }
  }
  return references;
}

export async function lockMedia(tx: Prisma.TransactionClient) {
  // The first SQL statement obtains SQLite's writer lock before reading references.
  await tx.uploadMaintenance.upsert({
    where: { id: 1 },
    create: { id: 1, revision: 1 },
    update: { revision: { increment: 1 } },
  });
}

export async function protectSavedReferences(
  tx: Prisma.TransactionClient,
  origin: string,
) {
  const paths = [...(await savedUploadReferences(tx, origin))];
  for (let offset = 0; offset < paths.length; offset += 100) {
    const batch = paths.slice(offset, offset + 100);
    const unavailable = await tx.uploadAsset.findFirst({
      where: { path: { in: batch }, state: { in: ['DELETING', 'DELETED'] } },
    });
    if (unavailable)
      throw new ConflictException(
        'An image has been removed by upload cleanup. Upload it again before saving.',
      );
    await tx.uploadAsset.updateMany({
      where: { path: { in: batch }, state: 'ACTIVE' },
      data: { unreferencedAt: null },
    });
  }
}
