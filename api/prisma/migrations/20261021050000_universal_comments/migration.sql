-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommentVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Migrate forum comments (parents first, then replies)
INSERT INTO "Comment" ("id", "content", "score", "resourceType", "resourceId", "authorId", "parentId", "createdAt", "updatedAt")
SELECT "id", "content", "score", 'forum', "postId", "authorId", "parentId", "createdAt", "updatedAt"
FROM "ForumComment"
WHERE "parentId" IS NULL;

INSERT INTO "Comment" ("id", "content", "score", "resourceType", "resourceId", "authorId", "parentId", "createdAt", "updatedAt")
SELECT "id", "content", "score", 'forum', "postId", "authorId", "parentId", "createdAt", "updatedAt"
FROM "ForumComment"
WHERE "parentId" IS NOT NULL;

INSERT INTO "CommentVote" ("id", "value", "userId", "commentId", "createdAt", "updatedAt")
SELECT "id", "value", "userId", "commentId", "createdAt", "updatedAt"
FROM "ForumCommentVote";

-- Drop old forum comment tables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
DROP TABLE "ForumCommentVote";
DROP TABLE "ForumComment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Comment_resourceType_resourceId_idx" ON "Comment"("resourceType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentVote_userId_commentId_key" ON "CommentVote"("userId", "commentId");
