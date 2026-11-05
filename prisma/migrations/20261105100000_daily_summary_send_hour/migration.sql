-- Owner-chosen hour for the daily WhatsApp summary (null = platform default).
ALTER TABLE "Organization" ADD COLUMN "dailySummarySendHour" INTEGER;
