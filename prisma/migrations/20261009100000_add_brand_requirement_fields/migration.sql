-- Brand requirement details for /brand-requirements (stored on brand posts).
ALTER TABLE "Post" ADD COLUMN "requirementTarget" TEXT;
ALTER TABLE "Post" ADD COLUMN "creatorCountMin" INTEGER;
ALTER TABLE "Post" ADD COLUMN "creatorCountMax" INTEGER;
ALTER TABLE "Post" ADD COLUMN "genderPreference" TEXT;
ALTER TABLE "Post" ADD COLUMN "deliverables" TEXT;
ALTER TABLE "Post" ADD COLUMN "visibility" TEXT;
ALTER TABLE "Post" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;
