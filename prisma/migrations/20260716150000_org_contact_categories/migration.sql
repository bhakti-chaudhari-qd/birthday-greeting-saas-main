-- Org-managed contact categories (replaces ContactCategory enum)

CREATE TABLE "ContactCategoryDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContactCategoryDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContactCategoryDefinition_organizationId_name_key"
ON "ContactCategoryDefinition"("organizationId", "name");

CREATE INDEX "ContactCategoryDefinition_organizationId_idx"
ON "ContactCategoryDefinition"("organizationId");

ALTER TABLE "ContactCategoryDefinition"
ADD CONSTRAINT "ContactCategoryDefinition_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Contact" ADD COLUMN "categoryId" TEXT;

-- Migrate legacy enum values into per-org definitions
INSERT INTO "ContactCategoryDefinition" ("id", "organizationId", "name", "createdAt", "updatedAt")
SELECT
  md5(c."organizationId" || ':' || c."category"::text),
  c."organizationId",
  CASE c."category"::text
    WHEN 'VVIP' THEN 'VVIP'
    WHEN 'VIP' THEN 'VIP'
    WHEN 'RELATIVE' THEN 'Relative'
    WHEN 'FRIEND' THEN 'Friend'
    ELSE c."category"::text
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "organizationId", "category"
  FROM "Contact"
  WHERE "category" IS NOT NULL
) AS c;

UPDATE "Contact" AS contact
SET "categoryId" = md5(contact."organizationId" || ':' || contact."category"::text)
WHERE contact."category" IS NOT NULL;

-- Seed default categories for orgs that have none yet
INSERT INTO "ContactCategoryDefinition" ("id", "organizationId", "name", "createdAt", "updatedAt")
SELECT
  md5(o."id" || ':default:' || d.name),
  o."id",
  d.name,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
CROSS JOIN (
  VALUES ('VVIP'), ('VIP'), ('Relative'), ('Friend')
) AS d(name)
WHERE NOT EXISTS (
  SELECT 1
  FROM "ContactCategoryDefinition" existing
  WHERE existing."organizationId" = o."id"
    AND lower(existing."name") = lower(d.name)
);

DROP INDEX IF EXISTS "Contact_organizationId_category_idx";

ALTER TABLE "Contact" DROP COLUMN "category";

DROP TYPE "ContactCategory";

CREATE INDEX "Contact_organizationId_categoryId_idx"
ON "Contact"("organizationId", "categoryId");

ALTER TABLE "Contact"
ADD CONSTRAINT "Contact_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "ContactCategoryDefinition"("id")
ON DELETE SET NULL ON UPDATE CASCADE;