-- Occasion Management (part 2): cut MessageTemplate/CategoryAutomationRule/
-- SendQueue over to occasionId FKs, delete removed "Custom" occasion data,
-- fold Organization's legacy per-occasion scalar automation fields into
-- CategoryAutomationRule (categoryId now nullable = "applies to contacts
-- with no category-specific rule"), and drop the old TemplateType/
-- OccasionType enums. Depends on 20260805120000_occasions_core having
-- already seeded Occasion rows.

-- "Custom" is being removed as a concept, not carried forward - delete any
-- existing CUSTOM-typed rows outright (respecting FK dependency order).
DELETE FROM "DeliveryLog"
WHERE "sendQueueId" IN (SELECT "id" FROM "SendQueue" WHERE "occasionType" = 'CUSTOM');

DELETE FROM "SendQueue" WHERE "occasionType" = 'CUSTOM';

DELETE FROM "CategoryAutomationRule" WHERE "occasionType" = 'CUSTOM';

DELETE FROM "MessageTemplate" WHERE "type" = 'CUSTOM';

-- MessageTemplate: type -> occasionId
ALTER TABLE "MessageTemplate" ADD COLUMN "occasionId" TEXT;

UPDATE "MessageTemplate"
SET "occasionId" = CASE "type"
  WHEN 'BIRTHDAY' THEN md5("organizationId" || ':system:birthday')
  WHEN 'ANNIVERSARY' THEN md5("organizationId" || ':seed:anniversary')
END;

ALTER TABLE "MessageTemplate" ALTER COLUMN "occasionId" SET NOT NULL;

DROP INDEX "MessageTemplate_organizationId_type_channel_isActive_idx";

CREATE INDEX "MessageTemplate_organizationId_occasionId_channel_isActive_idx"
ON "MessageTemplate"("organizationId", "occasionId", "channel", "isActive");

CREATE INDEX "MessageTemplate_occasionId_idx" ON "MessageTemplate"("occasionId");

ALTER TABLE "MessageTemplate" DROP COLUMN "type";

ALTER TABLE "MessageTemplate"
ADD CONSTRAINT "MessageTemplate_occasionId_fkey"
FOREIGN KEY ("occasionId") REFERENCES "Occasion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- CategoryAutomationRule: occasionType -> occasionId, categoryId becomes
-- nullable. A categoryId=NULL row means "applies to contacts with no
-- matching category-specific rule for this occasion" - this is the exact
-- fallback that Organization's legacy scalar fields implemented by hand in
-- application code; folding it into this model removes that duplication.
ALTER TABLE "CategoryAutomationRule" ADD COLUMN "occasionId" TEXT;

UPDATE "CategoryAutomationRule"
SET "occasionId" = CASE "occasionType"
  WHEN 'BIRTHDAY' THEN md5("organizationId" || ':system:birthday')
  WHEN 'ANNIVERSARY' THEN md5("organizationId" || ':seed:anniversary')
END;

ALTER TABLE "CategoryAutomationRule" ALTER COLUMN "occasionId" SET NOT NULL;

DROP INDEX "CategoryAutomationRule_organizationId_occasionType_idx";
DROP INDEX "CategoryAutomationRule_organizationId_occasionType_category_key";

ALTER TABLE "CategoryAutomationRule" DROP COLUMN "occasionType";

ALTER TABLE "CategoryAutomationRule" DROP CONSTRAINT "CategoryAutomationRule_categoryId_fkey";
ALTER TABLE "CategoryAutomationRule" ALTER COLUMN "categoryId" DROP NOT NULL;
ALTER TABLE "CategoryAutomationRule"
ADD CONSTRAINT "CategoryAutomationRule_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "ContactCategoryDefinition"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CategoryAutomationRule"
ADD CONSTRAINT "CategoryAutomationRule_occasionId_fkey"
FOREIGN KEY ("occasionId") REFERENCES "Occasion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "CategoryAutomationRule_organizationId_occasionId_idx"
ON "CategoryAutomationRule"("organizationId", "occasionId");

-- Postgres treats NULL as distinct in a plain composite unique index, so the
-- "all contacts" (categoryId=NULL) row needs its own partial unique index.
-- NOTE: these two partial indexes are not representable in schema.prisma and
-- are invisible to `prisma db pull`/`prisma validate` - see the comment
-- above the CategoryAutomationRule model.
CREATE UNIQUE INDEX "CategoryAutomationRule_org_occasion_category_key"
ON "CategoryAutomationRule"("organizationId", "occasionId", "categoryId")
WHERE "categoryId" IS NOT NULL;

CREATE UNIQUE INDEX "CategoryAutomationRule_org_occasion_allcontacts_key"
ON "CategoryAutomationRule"("organizationId", "occasionId")
WHERE "categoryId" IS NULL;

-- Fold Organization's legacy org-wide automation toggles into a
-- categoryId=NULL ("all contacts") CategoryAutomationRule row per occasion
-- that had them configured, so existing automation configuration survives
-- the removal of Organization's scalar fields below.
INSERT INTO "CategoryAutomationRule" (
  "id", "organizationId", "occasionId", "categoryId",
  "sendHour", "sendMinute",
  "smsEnabled", "smsTemplateId",
  "whatsappEnabled", "whatsappTemplateId",
  "emailEnabled", "emailTemplateId",
  "callEnabled", "aiAssistEnabled",
  "createdAt", "updatedAt"
)
SELECT
  md5(o."id" || ':legacy-all:birthday'),
  o."id",
  md5(o."id" || ':system:birthday'),
  NULL,
  o."automationSendHour", o."automationSendMinute",
  o."autoSendEnabled", o."birthdayTemplateId",
  o."whatsappAutoSendEnabled", o."whatsappBirthdayTemplateId",
  false, NULL,
  false, false,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organization" o
WHERE (o."autoSendEnabled" OR o."whatsappAutoSendEnabled")
  AND o."automationSendHour" IS NOT NULL
  AND o."automationSendMinute" IS NOT NULL;

INSERT INTO "CategoryAutomationRule" (
  "id", "organizationId", "occasionId", "categoryId",
  "sendHour", "sendMinute",
  "smsEnabled", "smsTemplateId",
  "whatsappEnabled", "whatsappTemplateId",
  "emailEnabled", "emailTemplateId",
  "callEnabled", "aiAssistEnabled",
  "createdAt", "updatedAt"
)
SELECT
  md5(o."id" || ':legacy-all:anniversary'),
  o."id",
  md5(o."id" || ':seed:anniversary'),
  NULL,
  o."automationSendHour", o."automationSendMinute",
  o."anniversaryAutoSendEnabled", o."anniversaryTemplateId",
  o."whatsappAnniversaryAutoSendEnabled", o."whatsappAnniversaryTemplateId",
  false, NULL,
  false, false,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organization" o
WHERE (o."anniversaryAutoSendEnabled" OR o."whatsappAnniversaryAutoSendEnabled")
  AND o."automationSendHour" IS NOT NULL
  AND o."automationSendMinute" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "Occasion" occ WHERE occ."id" = md5(o."id" || ':seed:anniversary'));

-- SendQueue: occasionType -> occasionId
ALTER TABLE "SendQueue" ADD COLUMN "occasionId" TEXT;

UPDATE "SendQueue"
SET "occasionId" = CASE "occasionType"
  WHEN 'BIRTHDAY' THEN md5("organizationId" || ':system:birthday')
  WHEN 'ANNIVERSARY' THEN md5("organizationId" || ':seed:anniversary')
END;

ALTER TABLE "SendQueue" ALTER COLUMN "occasionId" SET NOT NULL;

ALTER TABLE "SendQueue" DROP COLUMN "occasionType";

ALTER TABLE "SendQueue"
ADD CONSTRAINT "SendQueue_occasionId_fkey"
FOREIGN KEY ("occasionId") REFERENCES "Occasion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "SendQueue_organizationId_occasionId_idx" ON "SendQueue"("organizationId", "occasionId");

-- Organization: drop the 12 legacy per-occasion scalar fields + shared send
-- time, now fully superseded by Occasion + CategoryAutomationRule.
DROP INDEX "Organization_autoSendEnabled_isActive_idx";
DROP INDEX "Organization_whatsappAutoSendEnabled_isActive_idx";
DROP INDEX "Organization_anniversaryAutoSendEnabled_isActive_idx";
DROP INDEX "Organization_whatsappAnniversaryAutoSendEnabled_isActive_idx";
DROP INDEX "Organization_customAutoSendEnabled_isActive_idx";
DROP INDEX "Organization_whatsappCustomAutoSendEnabled_isActive_idx";

ALTER TABLE "Organization"
  DROP COLUMN "autoSendEnabled",
  DROP COLUMN "birthdayTemplateId",
  DROP COLUMN "whatsappAutoSendEnabled",
  DROP COLUMN "whatsappBirthdayTemplateId",
  DROP COLUMN "anniversaryAutoSendEnabled",
  DROP COLUMN "anniversaryTemplateId",
  DROP COLUMN "whatsappAnniversaryAutoSendEnabled",
  DROP COLUMN "whatsappAnniversaryTemplateId",
  DROP COLUMN "customAutoSendEnabled",
  DROP COLUMN "customTemplateId",
  DROP COLUMN "whatsappCustomAutoSendEnabled",
  DROP COLUMN "whatsappCustomTemplateId",
  DROP COLUMN "automationSendHour",
  DROP COLUMN "automationSendMinute";

-- Contact: drop the 3 fixed date-triples + the unused occasionData column,
-- now fully superseded by ContactOccasionDate.
DROP INDEX "Contact_organizationId_birthMonth_birthDay_idx";
DROP INDEX "Contact_organizationId_anniversaryMonth_anniversaryDay_idx";
DROP INDEX "Contact_organizationId_customOccasionMonth_customOccasionDa_idx";

ALTER TABLE "Contact"
  DROP COLUMN "dateOfBirth",
  DROP COLUMN "birthMonth",
  DROP COLUMN "birthDay",
  DROP COLUMN "anniversaryDate",
  DROP COLUMN "anniversaryMonth",
  DROP COLUMN "anniversaryDay",
  DROP COLUMN "customOccasionDate",
  DROP COLUMN "customOccasionMonth",
  DROP COLUMN "customOccasionDay",
  DROP COLUMN "occasionData";

DROP TYPE "TemplateType";
DROP TYPE "OccasionType";
