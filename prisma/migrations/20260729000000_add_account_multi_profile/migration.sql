-- Multi-profile architecture: one Account (keyed by mobileNumber) can now own
-- several User role-profiles under a single login, matching commit 531e831's
-- schema.prisma change. This migration was missing from that commit — without
-- it, the new Prisma Client (which expects the Account table and User.accountId
-- column) would be deployed against a database that doesn't have them yet.

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT '+91',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_mobileNumber_key" ON "Account"("mobileNumber");

-- AlterTable: mobileNumber moves its uniqueness to Account — User keeps the
-- column (and its non-unique search index) but several User rows can now
-- share the same mobileNumber via a shared accountId.
DROP INDEX "User_mobileNumber_key";

ALTER TABLE "User" ADD COLUMN "accountId" TEXT;

-- CreateIndex
CREATE INDEX "User_accountId_idx" ON "User"("accountId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
