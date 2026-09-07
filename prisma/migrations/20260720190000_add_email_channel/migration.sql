-- AlterEnum
ALTER TYPE "Channel" ADD VALUE IF NOT EXISTS 'EMAIL';

-- AlterTable Contact
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_organizationId_email_key" ON "Contact"("organizationId", "email");

-- AlterTable MessageTemplate
ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "emailSubject" TEXT;

-- AlterTable CategoryAutomationRule
ALTER TABLE "CategoryAutomationRule" ADD COLUMN IF NOT EXISTS "emailTemplateId" TEXT;

-- AlterTable SendQueue
ALTER TABLE "SendQueue" ADD COLUMN IF NOT EXISTS "emailSubject" TEXT;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CategoryAutomationRule" ADD CONSTRAINT "CategoryAutomationRule_emailTemplateId_fkey" FOREIGN KEY ("emailTemplateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;