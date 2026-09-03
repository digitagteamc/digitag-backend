-- Phase 2 of the enterprise broadcast expansion: composable segments, new
-- tap-destinations (POST/USER_PROFILE), and scheduled sends.

ALTER TABLE "Broadcast" ADD COLUMN "segment" JSONB;
ALTER TABLE "Broadcast" ADD COLUMN "postId" TEXT;
ALTER TABLE "Broadcast" ADD COLUMN "profileUserId" TEXT;
ALTER TABLE "Broadcast" ADD COLUMN "scheduledFor" TIMESTAMP(3);

CREATE INDEX "Broadcast_scheduledFor_idx" ON "Broadcast"("scheduledFor");
