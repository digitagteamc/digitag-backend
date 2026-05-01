-- CreateEnum
CREATE TYPE "InstagramVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED');

-- AlterTable
ALTER TABLE "CreatorProfile" ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "experienceLevel" TEXT,
ADD COLUMN     "facebookFollowers" INTEGER,
ADD COLUMN     "facebookHandle" TEXT,
ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "portfolioUrl" TEXT,
ADD COLUMN     "snapchatFollowers" INTEGER;

-- AlterTable
ALTER TABLE "FreelancerProfile" ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "facebookFollowers" INTEGER,
ADD COLUMN     "facebookHandle" TEXT,
ADD COLUMN     "instagramFollowers" INTEGER,
ADD COLUMN     "instagramHandle" TEXT,
ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "snapchatFollowers" INTEGER,
ADD COLUMN     "snapchatHandle" TEXT,
ADD COLUMN     "twitterFollowers" INTEGER,
ADD COLUMN     "twitterHandle" TEXT,
ADD COLUMN     "youtubeFollowers" INTEGER,
ADD COLUMN     "youtubeHandle" TEXT;

-- CreateTable
CREATE TABLE "InstagramVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instagramUrl" TEXT NOT NULL,
    "instagramUsername" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "status" "InstagramVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstagramVerification_userId_idx" ON "InstagramVerification"("userId");

-- CreateIndex
CREATE INDEX "InstagramVerification_verificationCode_idx" ON "InstagramVerification"("verificationCode");

-- CreateIndex
CREATE INDEX "InstagramVerification_status_expiresAt_idx" ON "InstagramVerification"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "InstagramVerification" ADD CONSTRAINT "InstagramVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
