-- CreatorProfile.tagId and FreelancerProfile.tagId were added to
-- schema.prisma at some point without a matching migration ever being
-- generated (BrandProfile.tagId, added later, did get one — see
-- 20260810120000_add_brand_profile). Production already has these two
-- columns from that earlier out-of-band change, so this uses
-- IF NOT EXISTS throughout to stay a no-op there while still bringing a
-- from-scratch database (dev, or any future rebuild) in sync with the
-- schema.

ALTER TABLE "CreatorProfile" ADD COLUMN IF NOT EXISTS "tagId" TEXT;
ALTER TABLE "FreelancerProfile" ADD COLUMN IF NOT EXISTS "tagId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorProfile_tagId_key" ON "CreatorProfile"("tagId");
CREATE UNIQUE INDEX IF NOT EXISTS "FreelancerProfile_tagId_key" ON "FreelancerProfile"("tagId");
