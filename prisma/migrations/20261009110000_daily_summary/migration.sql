-- Daily WhatsApp summary of each organization's sent/failed messages.
ALTER TABLE "Organization" ADD COLUMN "dailySummaryEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Organization" ADD COLUMN "dailySummaryLastSentFor" DATE;

CREATE TABLE "DailySummaryRecipient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailySummaryRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailySummaryRecipient_organizationId_mobile_key" ON "DailySummaryRecipient"("organizationId", "mobile");

ALTER TABLE "DailySummaryRecipient" ADD CONSTRAINT "DailySummaryRecipient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
