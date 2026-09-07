-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN "referralCode" TEXT;

-- Backfill existing vendors from slug (uppercase, hyphen-stripped) + short id suffix
UPDATE "Vendor"
SET "referralCode" = upper(replace("slug", '-', '')) || '-' || upper(substr("id", 1, 4))
WHERE "referralCode" IS NULL;

-- AlterTable
ALTER TABLE "Vendor" ALTER COLUMN "referralCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_referralCode_key" ON "Vendor"("referralCode");

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "referredByVendorId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "referredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Organization_referredByVendorId_idx" ON "Organization"("referredByVendorId");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_referredByVendorId_fkey" FOREIGN KEY ("referredByVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
