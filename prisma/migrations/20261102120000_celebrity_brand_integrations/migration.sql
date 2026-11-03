-- Mobile celebrity profile: the ad types chosen during Celebrity panel onboarding.
ALTER TABLE "Celebrity" ADD COLUMN "brandIntegrations" TEXT[] DEFAULT ARRAY[]::TEXT[];
