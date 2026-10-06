-- Brands: BrandProfile (KYC + admin approval), brand requirement posts
-- (Post.title/targetRoles), media channels (Brand Home "Top YouTube Channels"),
-- ad types + celebrities (Brand Home sections), channel catalog, ad requests
-- (+ items, event timeline) and channel CRM logins.
-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('TV', 'YOUTUBE', 'RADIO', 'OTT', 'PRINT', 'DIGITAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AdRequestStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AdRequestActor" AS ENUM ('BRAND', 'CHANNEL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ChannelUserRole" AS ENUM ('OWNER', 'MANAGER');

-- CreateEnum
CREATE TYPE "BrandApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "targetRoles" "UserRole"[] DEFAULT ARRAY[]::"UserRole"[],
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "profilePicture" TEXT,
    "profilePictureKey" TEXT,
    "email" TEXT,
    "pan" TEXT,
    "gstin" TEXT,
    "city" TEXT,
    "state" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "bio" TEXT,
    "contactPerson" TEXT,
    "contactDesignation" TEXT,
    "companySize" TEXT,
    "instagramHandle" TEXT,
    "youtubeHandle" TEXT,
    "tagId" TEXT,
    "approvalStatus" "BrandApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaChannel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ChannelType" NOT NULL DEFAULT 'YOUTUBE',
    "logoUrl" TEXT,
    "logoKey" TEXT,
    "subscriberCount" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "description" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "region" TEXT,
    "websiteUrl" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "iconUrl" TEXT,
    "accentColor" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
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
CREATE TABLE "ChannelCatalogItem" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "adTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "slot" TEXT,
    "durationSeconds" INTEGER,
    "mediaUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdRequest" (
    "id" TEXT NOT NULL,
    "brandUserId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" "AdRequestStatus" NOT NULL DEFAULT 'PENDING',
    "campaignName" TEXT,
    "brief" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budget" DECIMAL(14,2),
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "channelNote" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "adTypeName" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdRequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actor" "AdRequestActor" NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "fromStatus" "AdRequestStatus",
    "toStatus" "AdRequestStatus",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelUser" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "ChannelUserRole" NOT NULL DEFAULT 'MANAGER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_userId_key" ON "BrandProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_email_key" ON "BrandProfile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_tagId_key" ON "BrandProfile"("tagId");

-- CreateIndex
CREATE INDEX "BrandProfile_approvalStatus_createdAt_idx" ON "BrandProfile"("approvalStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaChannel_slug_key" ON "MediaChannel"("slug");

-- CreateIndex
CREATE INDEX "MediaChannel_type_isActive_subscriberCount_idx" ON "MediaChannel"("type", "isActive", "subscriberCount");

-- CreateIndex
CREATE UNIQUE INDEX "AdType_name_key" ON "AdType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AdType_slug_key" ON "AdType"("slug");

-- CreateIndex
CREATE INDEX "Celebrity_isActive_followerCount_idx" ON "Celebrity"("isActive", "followerCount");

-- CreateIndex
CREATE INDEX "ChannelCatalogItem_channelId_adTypeId_isActive_idx" ON "ChannelCatalogItem"("channelId", "adTypeId", "isActive");

-- CreateIndex
CREATE INDEX "AdRequest_brandUserId_createdAt_idx" ON "AdRequest"("brandUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdRequest_channelId_status_createdAt_idx" ON "AdRequest"("channelId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AdRequestItem_requestId_idx" ON "AdRequestItem"("requestId");

-- CreateIndex
CREATE INDEX "AdRequestEvent_requestId_createdAt_idx" ON "AdRequestEvent"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelUser_email_key" ON "ChannelUser"("email");

-- CreateIndex
CREATE INDEX "ChannelUser_channelId_idx" ON "ChannelUser"("channelId");

-- AddForeignKey
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelCatalogItem" ADD CONSTRAINT "ChannelCatalogItem_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "MediaChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelCatalogItem" ADD CONSTRAINT "ChannelCatalogItem_adTypeId_fkey" FOREIGN KEY ("adTypeId") REFERENCES "AdType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdRequest" ADD CONSTRAINT "AdRequest_brandUserId_fkey" FOREIGN KEY ("brandUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdRequest" ADD CONSTRAINT "AdRequest_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "MediaChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdRequestItem" ADD CONSTRAINT "AdRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AdRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdRequestItem" ADD CONSTRAINT "AdRequestItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "ChannelCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdRequestEvent" ADD CONSTRAINT "AdRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AdRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelUser" ADD CONSTRAINT "ChannelUser_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "MediaChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

