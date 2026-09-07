-- AlterTable Organization: shared IST send time + custom automation
ALTER TABLE "Organization" ADD COLUMN "customAutoSendEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "customTemplateId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "automationSendHour" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "Organization" ADD COLUMN "automationSendMinute" INTEGER NOT NULL DEFAULT 0;

-- AlterTable Contact: per-contact custom occasion date
ALTER TABLE "Contact" ADD COLUMN "customOccasionDate" DATE;
ALTER TABLE "Contact" ADD COLUMN "customOccasionMonth" INTEGER;
ALTER TABLE "Contact" ADD COLUMN "customOccasionDay" INTEGER;

-- CreateIndex
CREATE INDEX "Organization_customAutoSendEnabled_isActive_idx" ON "Organization"("customAutoSendEnabled", "isActive");
CREATE INDEX "Contact_organizationId_customOccasionMonth_customOccasionDay_idx" ON "Contact"("organizationId", "customOccasionMonth", "customOccasionDay");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_customTemplateId_fkey" FOREIGN KEY ("customTemplateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
