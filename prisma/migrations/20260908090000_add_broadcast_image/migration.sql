-- Broadcasts can now carry an optional image alongside title/body.
ALTER TABLE "Broadcast" ADD COLUMN "imageUrl" TEXT;
