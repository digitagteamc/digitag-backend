-- Chat-style ad lead survey responses from the website (/harsha-ad-survey).
-- CreateTable
CREATE TABLE "AdSurveyResponse" (
    "id" TEXT NOT NULL,
    "survey" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "profileLink" TEXT NOT NULL,
    "creatorType" TEXT NOT NULL,
    "platforms" TEXT[],
    "contentType" TEXT NOT NULL,
    "services" TEXT[],
    "videosPerMonth" TEXT,
    "languages" TEXT[],
    "serviceDuration" TEXT NOT NULL,
    "monthlyBudget" TEXT NOT NULL,
    "startTimeline" TEXT NOT NULL,
    "references" TEXT,
    "additionalNotes" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "ref" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdSurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdSurveyResponse_survey_createdAt_idx" ON "AdSurveyResponse"("survey", "createdAt");

-- CreateIndex
CREATE INDEX "AdSurveyResponse_mobileNumber_idx" ON "AdSurveyResponse"("mobileNumber");
