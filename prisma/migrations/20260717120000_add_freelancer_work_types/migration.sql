-- Social Media Manager-only: independent Part-Time/Full-Time checkboxes,
-- not a single choice — a freelancer can offer both.
ALTER TABLE "FreelancerProfile" ADD COLUMN "workTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
