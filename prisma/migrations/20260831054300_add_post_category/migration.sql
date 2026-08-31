-- Post.category exists in schema.prisma but had no migration — same class
-- of gap as 20260813070000_add_creator_freelancer_tagid. Production already
-- has this column from an earlier out-of-band change, which is exactly why
-- a from-scratch database (dev, or any future rebuild) never got it and
-- broke on the first prisma.post.create() call. IF NOT EXISTS keeps this a
-- safe no-op on production while being additive everywhere else.

ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "category" TEXT;
