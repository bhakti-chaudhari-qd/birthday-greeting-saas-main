-- Optional contact-group scope on message templates (null = All groups).
ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

ALTER TABLE "MessageTemplate"
  DROP CONSTRAINT IF EXISTS "MessageTemplate_categoryId_fkey";

ALTER TABLE "MessageTemplate"
  ADD CONSTRAINT "MessageTemplate_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ContactCategoryDefinition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "MessageTemplate_organizationId_categoryId_idx"
  ON "MessageTemplate"("organizationId", "categoryId");

CREATE INDEX IF NOT EXISTS "MessageTemplate_categoryId_idx"
  ON "MessageTemplate"("categoryId");
