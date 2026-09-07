-- WhatsApp MVP foundation: tenant template metadata + immutable queue snapshots.
-- Additive and backward-compatible with existing SMS rows.

ALTER TABLE "MessageTemplate" ADD COLUMN "whatsappParameterOrder" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "SendQueue" ADD COLUMN "whatsappTemplateName" TEXT;
ALTER TABLE "SendQueue" ADD COLUMN "whatsappLanguage" TEXT;
ALTER TABLE "SendQueue" ADD COLUMN "whatsappParameterValues" JSONB;
