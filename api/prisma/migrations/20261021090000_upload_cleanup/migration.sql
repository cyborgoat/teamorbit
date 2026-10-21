CREATE TABLE "UploadAsset" (
  "path" TEXT NOT NULL PRIMARY KEY,
  "size" INTEGER NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'ACTIVE',
  "unreferencedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "error" TEXT
);
CREATE INDEX "UploadAsset_state_unreferencedAt_idx" ON "UploadAsset"("state", "unreferencedAt");
CREATE TABLE "UploadMaintenance" (
  "id" INTEGER NOT NULL PRIMARY KEY,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "leaseOwner" TEXT,
  "leaseUntil" DATETIME
);
INSERT INTO "UploadMaintenance" ("id") VALUES (1);
CREATE TABLE "UploadCleanupRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "trigger" TEXT NOT NULL,
  "actorId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" DATETIME,
  "deletedCount" INTEGER NOT NULL DEFAULT 0,
  "deletedBytes" BIGINT NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT
);
