ALTER TABLE "User"
  ADD COLUMN "isDiscoverable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showOnlineStatus" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "shareDataForPersonalization" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pushNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "preferredLanguage" TEXT NOT NULL DEFAULT 'English';
