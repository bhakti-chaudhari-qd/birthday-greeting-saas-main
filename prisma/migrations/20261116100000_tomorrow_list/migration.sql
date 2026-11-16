-- Tomorrow's List: a day-before WhatsApp link to an expiring page that lists
-- the next day's occasions (names + last 4 digits of the mobile).
ALTER TABLE "Organization" ADD COLUMN "tomorrowListEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Organization" ADD COLUMN "tomorrowListAllowedByAdmin" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Organization" ADD COLUMN "tomorrowListLastSentFor" DATE;
ALTER TABLE "Organization" ADD COLUMN "tomorrowListSendHour" INTEGER;

ALTER TABLE "PlatformDailySummaryConfig" ADD COLUMN "tomorrowListEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformDailySummaryConfig" ADD COLUMN "tomorrowListTemplateName" TEXT;
ALTER TABLE "PlatformDailySummaryConfig" ADD COLUMN "tomorrowListLanguage" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "PlatformDailySummaryConfig" ADD COLUMN "tomorrowListSendHour" INTEGER NOT NULL DEFAULT 20;

CREATE TABLE "TomorrowListRecipient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TomorrowListRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TomorrowListRecipient_organizationId_mobile_key" ON "TomorrowListRecipient"("organizationId", "mobile");

ALTER TABLE "TomorrowListRecipient" ADD CONSTRAINT "TomorrowListRecipient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TomorrowListLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "forDate" DATE NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TomorrowListLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TomorrowListLink_tokenHash_key" ON "TomorrowListLink"("tokenHash");
CREATE UNIQUE INDEX "TomorrowListLink_organizationId_forDate_key" ON "TomorrowListLink"("organizationId", "forDate");
CREATE INDEX "TomorrowListLink_expiresAt_idx" ON "TomorrowListLink"("expiresAt");

ALTER TABLE "TomorrowListLink" ADD CONSTRAINT "TomorrowListLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
