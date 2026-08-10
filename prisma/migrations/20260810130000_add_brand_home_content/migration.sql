-- CreateEnum
CREATE TYPE "BrandRequirementTargetType" AS ENUM ('CREATORS', 'AGENCIES');

-- CreateEnum
CREATE TYPE "BrandRequirementStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "YoutubeChannel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "subscriberCount" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iconUrl" TEXT,
    "accentColor" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Celebrity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "role" TEXT,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "profileUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Celebrity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandRequirement" (
    "id" TEXT NOT NULL,
    "brandUserId" TEXT NOT NULL,
    "targetType" "BrandRequirementTargetType" NOT NULL DEFAULT 'CREATORS',
    "category" TEXT,
    "creatorCountMin" INTEGER,
    "creatorCountMax" INTEGER,
    "genderPreference" TEXT,
    "deliverables" TEXT,
    "visibility" TEXT,
    "message" TEXT,
    "status" "BrandRequirementStatus" NOT NULL DEFAULT 'ACTIVE',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "YoutubeChannel_isActive_idx" ON "YoutubeChannel"("isActive");

-- CreateIndex
CREATE INDEX "YoutubeChannel_category_idx" ON "YoutubeChannel"("category");

-- CreateIndex
CREATE INDEX "AdType_isActive_idx" ON "AdType"("isActive");

-- CreateIndex
CREATE INDEX "Celebrity_isActive_idx" ON "Celebrity"("isActive");

-- CreateIndex
CREATE INDEX "BrandRequirement_brandUserId_idx" ON "BrandRequirement"("brandUserId");

-- CreateIndex
CREATE INDEX "BrandRequirement_status_idx" ON "BrandRequirement"("status");

-- AddForeignKey
ALTER TABLE "BrandRequirement" ADD CONSTRAINT "BrandRequirement_brandUserId_fkey" FOREIGN KEY ("brandUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
