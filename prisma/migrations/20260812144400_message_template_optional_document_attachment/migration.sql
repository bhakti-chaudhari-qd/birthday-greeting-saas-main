-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN     "documentTemplateId" TEXT,
ADD COLUMN     "includePersonalizedPdf" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "MessageTemplate_documentTemplateId_idx" ON "MessageTemplate"("documentTemplateId");

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_documentTemplateId_fkey" FOREIGN KEY ("documentTemplateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
