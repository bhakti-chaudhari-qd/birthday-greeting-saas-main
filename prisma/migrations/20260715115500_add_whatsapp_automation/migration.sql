ALTER TABLE "Organization"
ADD COLUMN "whatsappAutoSendEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "whatsappBirthdayTemplateId" TEXT,
ADD COLUMN "whatsappAnniversaryAutoSendEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "whatsappAnniversaryTemplateId" TEXT,
ADD COLUMN "whatsappCustomAutoSendEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "whatsappCustomTemplateId" TEXT;

ALTER TABLE "Organization"
ADD CONSTRAINT "Organization_whatsappBirthdayTemplateId_fkey"
FOREIGN KEY ("whatsappBirthdayTemplateId") REFERENCES "MessageTemplate"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Organization"
ADD CONSTRAINT "Organization_whatsappAnniversaryTemplateId_fkey"
FOREIGN KEY ("whatsappAnniversaryTemplateId") REFERENCES "MessageTemplate"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Organization"
ADD CONSTRAINT "Organization_whatsappCustomTemplateId_fkey"
FOREIGN KEY ("whatsappCustomTemplateId") REFERENCES "MessageTemplate"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Organization_whatsappAutoSendEnabled_isActive_idx"
ON "Organization"("whatsappAutoSendEnabled", "isActive");

CREATE INDEX "Organization_whatsappAnniversaryAutoSendEnabled_isActive_idx"
ON "Organization"("whatsappAnniversaryAutoSendEnabled", "isActive");

CREATE INDEX "Organization_whatsappCustomAutoSendEnabled_isActive_idx"
ON "Organization"("whatsappCustomAutoSendEnabled", "isActive");
