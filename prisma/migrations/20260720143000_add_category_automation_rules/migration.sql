-- Restore trigram search indexes if a prior local drift migration dropped them
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "Contact_name_trgm_idx" ON "Contact" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Contact_mobile_trgm_idx" ON "Contact" USING gin ("mobile" gin_trgm_ops);

-- CreateTable
CREATE TABLE "CategoryAutomationRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "occasionType" "OccasionType" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sendHour" INTEGER NOT NULL DEFAULT 6,
    "sendMinute" INTEGER NOT NULL DEFAULT 0,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "smsTemplateId" TEXT,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappTemplateId" TEXT,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "callEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiAssistEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryAutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategoryAutomationRule_organizationId_occasionType_idx" ON "CategoryAutomationRule"("organizationId", "occasionType");

-- CreateIndex
CREATE INDEX "CategoryAutomationRule_categoryId_idx" ON "CategoryAutomationRule"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryAutomationRule_organizationId_occasionType_category_key" ON "CategoryAutomationRule"("organizationId", "occasionType", "categoryId");

-- AddForeignKey
ALTER TABLE "CategoryAutomationRule" ADD CONSTRAINT "CategoryAutomationRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryAutomationRule" ADD CONSTRAINT "CategoryAutomationRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ContactCategoryDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryAutomationRule" ADD CONSTRAINT "CategoryAutomationRule_smsTemplateId_fkey" FOREIGN KEY ("smsTemplateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryAutomationRule" ADD CONSTRAINT "CategoryAutomationRule_whatsappTemplateId_fkey" FOREIGN KEY ("whatsappTemplateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;