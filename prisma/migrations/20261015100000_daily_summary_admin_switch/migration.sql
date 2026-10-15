-- Platform Admin switch for each organization's daily WhatsApp summary.
ALTER TABLE "Organization" ADD COLUMN "dailySummaryAllowedByAdmin" BOOLEAN NOT NULL DEFAULT true;
