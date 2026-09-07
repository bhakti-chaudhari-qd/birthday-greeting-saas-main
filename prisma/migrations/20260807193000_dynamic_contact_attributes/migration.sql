-- Dynamic contact attributes foundation.
CREATE TYPE "ContactFieldType" AS ENUM (
  'TEXT',
  'NUMBER',
  'DATE',
  'EMAIL',
  'PHONE',
  'BOOLEAN',
  'SELECT'
);

ALTER TABLE "Contact"
ADD COLUMN "attributes" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "ContactImportJob"
ADD COLUMN "fieldMappings" JSONB;

CREATE TABLE "ContactFieldDefinition" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" "ContactFieldType" NOT NULL DEFAULT 'TEXT',
  "options" JSONB,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ContactFieldDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContactFieldDefinition_organizationId_key_key"
ON "ContactFieldDefinition"("organizationId", "key");

CREATE INDEX "ContactFieldDefinition_organizationId_isActive_idx"
ON "ContactFieldDefinition"("organizationId", "isActive");

CREATE INDEX "ContactFieldDefinition_organizationId_sortOrder_idx"
ON "ContactFieldDefinition"("organizationId", "sortOrder");

ALTER TABLE "ContactFieldDefinition"
ADD CONSTRAINT "ContactFieldDefinition_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
