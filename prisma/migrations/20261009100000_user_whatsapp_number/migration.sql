-- WhatsApp number for organization users (may differ from the login mobile,
-- and is not unique). Existing accounts start with their mobile.
ALTER TABLE "User" ADD COLUMN "whatsappNumber" TEXT;

UPDATE "User" SET "whatsappNumber" = "mobile" WHERE "mobile" IS NOT NULL;
