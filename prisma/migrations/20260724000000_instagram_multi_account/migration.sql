-- Multi-account Instagram support: a user can verify and keep several
-- Instagram accounts (InstagramVerification already tracks one row per
-- verification attempt, keyed by userId — this just adds what was missing:
-- a per-account follower count, and a REMOVED status so a connected account
-- can be disconnected without losing its verification history.
ALTER TABLE "InstagramVerification" ADD COLUMN "followers" INTEGER;
ALTER TYPE "InstagramVerificationStatus" ADD VALUE 'REMOVED';
