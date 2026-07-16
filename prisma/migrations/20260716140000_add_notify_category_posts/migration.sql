-- Freelancers only: "a Creator posted in one of my categories" preference,
-- separate from pushNotificationsEnabled since this is much higher-volume.
ALTER TABLE "User" ADD COLUMN "notifyCategoryPosts" BOOLEAN NOT NULL DEFAULT true;
