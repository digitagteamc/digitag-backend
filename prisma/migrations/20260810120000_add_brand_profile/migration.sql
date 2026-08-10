-- CreateEnum
CREATE TYPE "BrandApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "profilePicture" TEXT,
    "profilePictureKey" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "pan" TEXT,
    "gstin" TEXT,
    "city" TEXT,
    "state" TEXT,
    "website" TEXT,
    "tagId" TEXT,
    "approvalStatus" "BrandApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_userId_key" ON "BrandProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_email_key" ON "BrandProfile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_tagId_key" ON "BrandProfile"("tagId");

-- CreateIndex
CREATE INDEX "BrandProfile_approvalStatus_idx" ON "BrandProfile"("approvalStatus");

-- AddForeignKey
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
