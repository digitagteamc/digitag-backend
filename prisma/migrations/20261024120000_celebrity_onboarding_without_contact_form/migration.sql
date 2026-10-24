-- The Celebrity panel now goes straight to the signed onboarding (done by the
-- DigiTag team), so there is no contact form or submit token.
ALTER TABLE "CelebrityApplication" ALTER COLUMN "phone" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "submitTokenHash" DROP NOT NULL;
