/*
  Warnings:

  - You are about to drop the column `instagramLink` on the `CreatorProfile` table. All the data in the column will be lost.
  - You are about to drop the column `snapchatLink` on the `CreatorProfile` table. All the data in the column will be lost.
  - You are about to drop the column `twitterLink` on the `CreatorProfile` table. All the data in the column will be lost.
  - You are about to drop the column `youtubeLink` on the `CreatorProfile` table. All the data in the column will be lost.
  - You are about to drop the column `instagramLink` on the `FreelancerProfile` table. All the data in the column will be lost.
  - You are about to drop the column `snapchatLink` on the `FreelancerProfile` table. All the data in the column will be lost.
  - You are about to drop the column `twitterLink` on the `FreelancerProfile` table. All the data in the column will be lost.
  - You are about to drop the column `youtubeLink` on the `FreelancerProfile` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "FreelancerAvailability" AS ENUM ('AVAILABLE', 'BUSY', 'NOT_AVAILABLE');

-- AlterTable
ALTER TABLE "CreatorProfile" DROP COLUMN "instagramLink",
DROP COLUMN "snapchatLink",
DROP COLUMN "twitterLink",
DROP COLUMN "youtubeLink",
ADD COLUMN     "instagramFollowers" INTEGER,
ADD COLUMN     "instagramHandle" TEXT,
ADD COLUMN     "isAvailableForCollab" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "preferredCollabType" "CollaborationType" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "snapchatHandle" TEXT,
ADD COLUMN     "twitterFollowers" INTEGER,
ADD COLUMN     "twitterHandle" TEXT,
ADD COLUMN     "youtubeFollowers" INTEGER,
ADD COLUMN     "youtubeHandle" TEXT;

-- AlterTable
ALTER TABLE "FreelancerProfile" DROP COLUMN "instagramLink",
DROP COLUMN "snapchatLink",
DROP COLUMN "twitterLink",
DROP COLUMN "youtubeLink",
ADD COLUMN     "availability" "FreelancerAvailability" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "experienceLevel" "ExperienceLevel",
ADD COLUMN     "hourlyRate" DECIMAL(10,2),
ADD COLUMN     "portfolioUrl" TEXT,
ADD COLUMN     "servicesOffered" TEXT,
ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "CreatorProfile_isAvailableForCollab_idx" ON "CreatorProfile"("isAvailableForCollab");

-- CreateIndex
CREATE INDEX "FreelancerProfile_availability_idx" ON "FreelancerProfile"("availability");
