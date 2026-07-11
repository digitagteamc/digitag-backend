CREATE TYPE "SocialPlatform" AS ENUM ('YOUTUBE', 'FACEBOOK');
CREATE TYPE "SocialVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED');

CREATE TABLE "SocialVerification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "platform" "SocialPlatform" NOT NULL,
  "status" "SocialVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "socialAccountId" TEXT,
  "accountName" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialVerification_userId_platform_status_idx" ON "SocialVerification"("userId", "platform", "status");
CREATE UNIQUE INDEX "SocialVerification_platform_socialAccountId_key" ON "SocialVerification"("platform", "socialAccountId");
ALTER TABLE "SocialVerification" ADD CONSTRAINT "SocialVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
