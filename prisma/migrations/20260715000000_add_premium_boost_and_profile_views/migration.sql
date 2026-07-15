-- Premium "Boost" feature: boostedUntil drives feed sort priority while in
-- the future; boostedAt is the timestamp the monthly-allowance count reads,
-- kept separate so an expired boost still counts toward the month it was
-- actually used in.
ALTER TABLE "Post" ADD COLUMN "boostedUntil" TIMESTAMP(3);
ALTER TABLE "Post" ADD COLUMN "boostedAt" TIMESTAMP(3);
CREATE INDEX "Post_boostedUntil_idx" ON "Post"("boostedUntil");

-- Premium "Who Viewed My Profile": one row per (viewer, viewed) pair.
CREATE TABLE "ProfileView" (
    "id" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "viewedId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfileView_viewerId_viewedId_key" ON "ProfileView"("viewerId", "viewedId");
CREATE INDEX "ProfileView_viewedId_viewedAt_idx" ON "ProfileView"("viewedId", "viewedAt");

ALTER TABLE "ProfileView" ADD CONSTRAINT "ProfileView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileView" ADD CONSTRAINT "ProfileView_viewedId_fkey" FOREIGN KEY ("viewedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
