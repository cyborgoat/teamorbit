-- CreateTable
CREATE TABLE "EventRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "EventRecipient_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "location" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'GLOBAL',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("id", "title", "description", "startAt", "endAt", "location", "coverImageUrl", "createdById", "createdAt", "updatedAt") SELECT "id", "title", "description", "startAt", "endAt", "location", "coverImageUrl", "createdById", "createdAt", "updatedAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EventRecipient_userId_idx" ON "EventRecipient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRecipient_eventId_userId_key" ON "EventRecipient"("eventId", "userId");
