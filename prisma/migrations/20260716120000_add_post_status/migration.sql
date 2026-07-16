-- Owner-driven post lifecycle, separate from isActive (delete) and isHidden
-- (admin moderation): COMPLETED keeps the post visible but blocks new
-- collaboration requests from anyone; CLOSED hides it from feeds like a
-- delete, but is meant to be reversible by the owner reopening it.
CREATE TYPE "PostStatus" AS ENUM ('OPEN', 'COMPLETED', 'CLOSED');

ALTER TABLE "Post" ADD COLUMN "status" "PostStatus" NOT NULL DEFAULT 'OPEN';
