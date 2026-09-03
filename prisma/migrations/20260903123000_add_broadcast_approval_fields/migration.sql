-- Phase 4 of the enterprise broadcast expansion: approval workflow tracking.

ALTER TABLE "Broadcast" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "Broadcast" ADD COLUMN "approvedByName" TEXT;
ALTER TABLE "Broadcast" ADD COLUMN "rejectedReason" TEXT;
