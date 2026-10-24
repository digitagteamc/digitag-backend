-- Celebrity panel: optional profile photo, and follower / subscriber counts per account.
ALTER TABLE "CelebrityApplication" ADD COLUMN "photoKey" TEXT,
ADD COLUMN "instagramAccounts" JSONB;
