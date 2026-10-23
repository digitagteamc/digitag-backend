-- CreateEnum
CREATE TYPE "CelebrityApplicationStatus" AS ENUM ('REQUESTED', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "CelebrityApplication" (
    "id" TEXT NOT NULL,
    "status" "CelebrityApplicationStatus" NOT NULL DEFAULT 'REQUESTED',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "availability" TEXT,
    "interested" BOOLEAN NOT NULL DEFAULT true,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "onboardingDate" TIMESTAMP(3),
    "effectiveDate" TIMESTAMP(3),
    "legalName" TEXT,
    "partnerType" TEXT,
    "instagramHandles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "youtubeChannels" JSONB,
    "brandIntegrations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "managementAgreed" BOOLEAN NOT NULL DEFAULT false,
    "signatureKey" TEXT,
    "signedName" TEXT,
    "signedDate" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "submitTokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CelebrityApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CelebrityApplication_status_createdAt_idx" ON "CelebrityApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CelebrityApplication_email_idx" ON "CelebrityApplication"("email");

