-- Creator onboarding form submissions from the website (/creator-onboarding-frm1).
-- CreateTable
CREATE TABLE "CreatorOnboarding" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "languages" TEXT,
    "category" TEXT NOT NULL,
    "bio" TEXT,
    "instagramUrl" TEXT,
    "instagramFollowers" INTEGER,
    "youtubeUrl" TEXT,
    "youtubeSubscribers" INTEGER,
    "facebookUrl" TEXT,
    "twitterUrl" TEXT,
    "linkedinUrl" TEXT,
    "otherSocialUrl" TEXT,
    "referredBy" TEXT,
    "agreementVersion" TEXT NOT NULL,
    "signedName" TEXT NOT NULL,
    "signatureImage" TEXT NOT NULL,
    "agreedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreatorOnboarding_createdAt_idx" ON "CreatorOnboarding"("createdAt");

-- CreateIndex
CREATE INDEX "CreatorOnboarding_mobileNumber_idx" ON "CreatorOnboarding"("mobileNumber");

