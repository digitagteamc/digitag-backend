-- Add one-time location pin sharing to chat messages
ALTER TABLE "Message" ADD COLUMN "locationLat" DOUBLE PRECISION;
ALTER TABLE "Message" ADD COLUMN "locationLng" DOUBLE PRECISION;
