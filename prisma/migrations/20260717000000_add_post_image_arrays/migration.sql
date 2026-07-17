-- Portfolio-category posts (Photography, Property Rental, Fashion Designers,
-- Models, Styling & Makeup) can carry up to 3 work-sample images. Legacy
-- imageUrl/imageKey stay in sync with the first array entry for any
-- consumer still reading the singular field.
ALTER TABLE "Post" ADD COLUMN "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Post" ADD COLUMN "imageKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill existing single-image posts into the new array so nothing
-- currently displaying an image loses it.
UPDATE "Post" SET "imageUrls" = ARRAY["imageUrl"] WHERE "imageUrl" IS NOT NULL;
UPDATE "Post" SET "imageKeys" = ARRAY["imageKey"] WHERE "imageKey" IS NOT NULL;
