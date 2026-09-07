-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "birthdayTemplateId" TEXT;

-- CreateIndex
CREATE INDEX "Organization_autoSendEnabled_isActive_idx" ON "Organization"("autoSendEnabled", "isActive");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_birthdayTemplateId_fkey" FOREIGN KEY ("birthdayTemplateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
