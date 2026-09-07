-- AlterEnum
CREATE TYPE "ContactCategory" AS ENUM ('VVIP', 'VIP', 'RELATIVE', 'FRIEND');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "category" "ContactCategory",
ADD COLUMN "address" TEXT;

-- CreateIndex
CREATE INDEX "Contact_organizationId_category_idx" ON "Contact"("organizationId", "category");
