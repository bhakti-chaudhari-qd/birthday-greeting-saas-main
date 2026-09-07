-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "anniversaryAutoSendEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "anniversaryTemplateId" TEXT;

-- CreateIndex
CREATE INDEX "Organization_anniversaryAutoSendEnabled_isActive_idx" ON "Organization"("anniversaryAutoSendEnabled", "isActive");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_anniversaryTemplateId_fkey" FOREIGN KEY ("anniversaryTemplateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
