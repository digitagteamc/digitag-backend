-- Phase 1 of the enterprise broadcast expansion: a first-class Broadcast
-- entity. Previously a sent broadcast left no persisted record beyond a
-- free-text AdminActivityLog line and untracked Notification rows — no way
-- to list past broadcasts, see per-broadcast stats, or compute read-rate.

CREATE TYPE "BroadcastStatus" AS ENUM ('SENT', 'SCHEDULED', 'PENDING_APPROVAL', 'REJECTED', 'FAILED');

CREATE TABLE "Broadcast" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "categoryId" TEXT,
  "userIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "action" TEXT NOT NULL DEFAULT 'NONE',
  "status" "BroadcastStatus" NOT NULL DEFAULT 'SENT',
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Broadcast_status_idx" ON "Broadcast"("status");
CREATE INDEX "Broadcast_createdAt_idx" ON "Broadcast"("createdAt");

ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Link Notification rows back to the Broadcast that created them, so
-- read-rate is a live count (isRead=true vs total per broadcastId) instead
-- of a maintained counter that could drift.
ALTER TABLE "Notification" ADD COLUMN "readAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN "broadcastId" TEXT;

CREATE INDEX "Notification_broadcastId_idx" ON "Notification"("broadcastId");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE SET NULL ON UPDATE CASCADE;
