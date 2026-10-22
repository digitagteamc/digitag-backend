-- Past brand collaborations a channel showcases from the CRM.
CREATE TABLE "ChannelShowcase" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "brandLogoUrl" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mediaUrl" TEXT,
    "adTypeName" TEXT,
    "campaignDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelShowcase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChannelShowcase_channelId_isActive_sortOrder_idx" ON "ChannelShowcase"("channelId", "isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "ChannelShowcase" ADD CONSTRAINT "ChannelShowcase_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "MediaChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
