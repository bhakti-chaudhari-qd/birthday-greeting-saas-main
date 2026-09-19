-- Adds extra (non-primary) category tags on a contact, so a contact can
-- belong to multiple categories (e.g. Friend + Relative) for filtering and
-- manual/bulk sends. The existing Contact.categoryId stays as the single
-- "primary" category used to resolve automatic-greeting routing.
CREATE TABLE "ContactCategoryTag" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactCategoryTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContactCategoryTag_contactId_categoryId_key" ON "ContactCategoryTag"("contactId", "categoryId");

CREATE INDEX "ContactCategoryTag_categoryId_idx" ON "ContactCategoryTag"("categoryId");

ALTER TABLE "ContactCategoryTag" ADD CONSTRAINT "ContactCategoryTag_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactCategoryTag" ADD CONSTRAINT "ContactCategoryTag_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ContactCategoryDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
