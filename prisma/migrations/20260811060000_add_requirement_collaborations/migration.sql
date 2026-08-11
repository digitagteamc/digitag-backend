-- AddColumn
ALTER TABLE "Collaboration" ADD COLUMN "requirementId" TEXT;

-- DropIndex (old 3-column uniqueness, replaced below)
DROP INDEX "Collaboration_senderId_receiverId_postId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Collaboration_senderId_receiverId_postId_requirementId_key" ON "Collaboration"("senderId", "receiverId", "postId", "requirementId");

-- CreateIndex
CREATE INDEX "Collaboration_requirementId_idx" ON "Collaboration"("requirementId");

-- AddForeignKey
ALTER TABLE "Collaboration" ADD CONSTRAINT "Collaboration_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "BrandRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
