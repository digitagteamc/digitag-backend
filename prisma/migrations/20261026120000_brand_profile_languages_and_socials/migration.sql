-- Brand Complete Profile: languages, Snapchat / Twitter handles and follower counts per platform.
ALTER TABLE "BrandProfile" ADD COLUMN "language" TEXT,
ADD COLUMN "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "instagramFollowers" INTEGER,
ADD COLUMN "youtubeFollowers" INTEGER,
ADD COLUMN "snapchatHandle" TEXT,
ADD COLUMN "snapchatFollowers" INTEGER,
ADD COLUMN "twitterHandle" TEXT,
ADD COLUMN "twitterFollowers" INTEGER;
