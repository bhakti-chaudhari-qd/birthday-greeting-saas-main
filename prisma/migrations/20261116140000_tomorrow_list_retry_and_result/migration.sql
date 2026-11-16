-- Retry failed scheduled Tomorrow's List sends (up to a cap) instead of
-- treating the day as done, and keep the latest outcome for the Owner.
ALTER TABLE "Organization" ADD COLUMN "tomorrowListAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Organization" ADD COLUMN "tomorrowListAttemptsFor" DATE;
ALTER TABLE "Organization" ADD COLUMN "tomorrowListLastResult" JSONB;
