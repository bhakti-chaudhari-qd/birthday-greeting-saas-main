-- AlterTable
ALTER TABLE "SendQueue" ADD COLUMN     "generatedDocumentId" TEXT;

-- CreateIndex
CREATE INDEX "SendQueue_generatedDocumentId_idx" ON "SendQueue"("generatedDocumentId");

-- AddForeignKey
ALTER TABLE "SendQueue" ADD CONSTRAINT "SendQueue_generatedDocumentId_fkey" FOREIGN KEY ("generatedDocumentId") REFERENCES "GeneratedDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
