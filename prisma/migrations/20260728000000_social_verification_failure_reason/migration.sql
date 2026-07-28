-- Store why a YouTube/Facebook verification failed (e.g. "no channel on this
-- account", "no Facebook Page found") so the mobile app can show the real
-- reason instead of a generic "verification failed" message.
ALTER TABLE "SocialVerification" ADD COLUMN "failureReason" TEXT;
