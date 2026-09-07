-- Occasion Management: introduce a dynamic, org-managed Occasion entity to
-- replace the hardcoded BIRTHDAY/ANNIVERSARY/CUSTOM enums. This migration is
-- additive only (creates tables, seeds Birthday + Anniversary-where-used,
-- backfills dates) - old Contact date columns and the enums are dropped in
-- the follow-up 20260805130000_occasions_fk_cutover migration once all
-- backend code has moved onto the new tables.

CREATE TABLE "Occasion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Occasion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Occasion_organizationId_name_key"
ON "Occasion"("organizationId", "name");

CREATE INDEX "Occasion_organizationId_idx"
ON "Occasion"("organizationId");

CREATE INDEX "Occasion_organizationId_isSystem_idx"
ON "Occasion"("organizationId", "isSystem");

ALTER TABLE "Occasion"
ADD CONSTRAINT "Occasion_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Birthday is the one permanent system occasion - every org gets one.
INSERT INTO "Occasion" ("id", "organizationId", "name", "isSystem", "createdAt", "updatedAt")
SELECT md5(o."id" || ':system:birthday'), o."id", 'Birthday', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organization" o;

-- Anniversary is no longer a system occasion - seed it only for orgs that
-- already have anniversary data or configuration, so orgs that never used it
-- do not get an unused row. New orgs create it (or anything else) themselves
-- through Occasion Management.
INSERT INTO "Occasion" ("id", "organizationId", "name", "isSystem", "createdAt", "updatedAt")
SELECT md5(o."id" || ':seed:anniversary'), o."id", 'Anniversary', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organization" o
WHERE EXISTS (
    SELECT 1 FROM "Contact" c
    WHERE c."organizationId" = o."id" AND c."anniversaryMonth" IS NOT NULL
  )
  OR EXISTS (
    SELECT 1 FROM "MessageTemplate" t
    WHERE t."organizationId" = o."id" AND t."type" = 'ANNIVERSARY'
  )
  OR EXISTS (
    SELECT 1 FROM "CategoryAutomationRule" r
    WHERE r."organizationId" = o."id" AND r."occasionType" = 'ANNIVERSARY'
  )
  OR EXISTS (
    SELECT 1 FROM "SendQueue" sq
    WHERE sq."organizationId" = o."id" AND sq."occasionType" = 'ANNIVERSARY'
  )
  OR o."anniversaryTemplateId" IS NOT NULL
  OR o."whatsappAnniversaryTemplateId" IS NOT NULL
  OR o."anniversaryAutoSendEnabled" = true
  OR o."whatsappAnniversaryAutoSendEnabled" = true;

-- Custom is intentionally NOT seeded: "Custom" is being removed as a concept,
-- not carried forward as a occasion. Any existing CUSTOM-typed data is
-- deleted in the follow-up migration.

CREATE TABLE "ContactOccasionDate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "occasionId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContactOccasionDate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContactOccasionDate_contactId_occasionId_key"
ON "ContactOccasionDate"("contactId", "occasionId");

CREATE INDEX "ContactOccasionDate_organizationId_occasionId_month_day_idx"
ON "ContactOccasionDate"("organizationId", "occasionId", "month", "day");

ALTER TABLE "ContactOccasionDate"
ADD CONSTRAINT "ContactOccasionDate_contactId_fkey"
FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactOccasionDate"
ADD CONSTRAINT "ContactOccasionDate_occasionId_fkey"
FOREIGN KEY ("occasionId") REFERENCES "Occasion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill Birthday dates.
INSERT INTO "ContactOccasionDate" ("id", "organizationId", "contactId", "occasionId", "date", "month", "day", "createdAt", "updatedAt")
SELECT
  md5(c."id" || ':system:birthday'),
  c."organizationId",
  c."id",
  md5(c."organizationId" || ':system:birthday'),
  c."dateOfBirth",
  c."birthMonth",
  c."birthDay",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Contact" c
WHERE c."birthMonth" IS NOT NULL AND c."birthDay" IS NOT NULL AND c."dateOfBirth" IS NOT NULL;

-- Backfill Anniversary dates, only for contacts whose org actually got an
-- Anniversary occasion seeded above.
INSERT INTO "ContactOccasionDate" ("id", "organizationId", "contactId", "occasionId", "date", "month", "day", "createdAt", "updatedAt")
SELECT
  md5(c."id" || ':seed:anniversary'),
  c."organizationId",
  c."id",
  md5(c."organizationId" || ':seed:anniversary'),
  c."anniversaryDate",
  c."anniversaryMonth",
  c."anniversaryDay",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Contact" c
WHERE c."anniversaryMonth" IS NOT NULL AND c."anniversaryDay" IS NOT NULL AND c."anniversaryDate" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "Occasion" occ
    WHERE occ."id" = md5(c."organizationId" || ':seed:anniversary')
  );

-- Custom occasion dates are intentionally discarded (Custom is being removed).
