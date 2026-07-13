-- App-issue reports join the existing admin Reports queue
ALTER TYPE "ReportType" ADD VALUE 'ISSUE';

-- "Notify Me" launch waitlist (home hero coming-soon slide)
CREATE TABLE "LaunchWaitlist" (
    "id" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaunchWaitlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LaunchWaitlist_mobileNumber_key" ON "LaunchWaitlist"("mobileNumber");
