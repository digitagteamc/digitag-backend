-- Mobile celebrity profile: real Instagram / YouTube details per celebrity.
ALTER TABLE "Celebrity" ADD COLUMN "instagramHandle" TEXT,
ADD COLUMN "instagramFollowers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "youtubeUrl" TEXT,
ADD COLUMN "youtubeSubscribers" INTEGER NOT NULL DEFAULT 0;
