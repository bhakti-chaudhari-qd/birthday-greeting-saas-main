-- Meta approval status of WhatsApp templates submitted or checked from the app.
ALTER TABLE "MessageTemplate" ADD COLUMN "whatsappApprovalStatus" TEXT;
ALTER TABLE "MessageTemplate" ADD COLUMN "whatsappApprovalCategory" TEXT;
ALTER TABLE "MessageTemplate" ADD COLUMN "whatsappRejectedReason" TEXT;
ALTER TABLE "MessageTemplate" ADD COLUMN "whatsappSubmittedAt" TIMESTAMP(3);
ALTER TABLE "MessageTemplate" ADD COLUMN "whatsappStatusCheckedAt" TIMESTAMP(3);
