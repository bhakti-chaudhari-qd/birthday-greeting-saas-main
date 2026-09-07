-- CreateEnum
CREATE TYPE "VendorOnboardingStatus" AS ENUM ('DRAFT', 'INVITED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VendorRegistrationInviteDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'AMBIGUOUS', 'FAILED');

-- AlterTable
ALTER TABLE "Vendor"
ADD COLUMN "mobile" TEXT,
ADD COLUMN "onboardingStatus" "VendorOnboardingStatus",
ADD COLUMN "registrationSubmittedAt" TIMESTAMP(3),
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "approvedByAdminId" TEXT;

-- Preserve the behavior of every vendor that predates onboarding.
UPDATE "Vendor"
SET "onboardingStatus" = 'APPROVED',
    "approvedAt" = COALESCE("approvedAt", "createdAt")
WHERE "onboardingStatus" IS NULL;

-- New vendors begin onboarding as drafts; legacy vendors remain approved.
ALTER TABLE "Vendor"
ALTER COLUMN "onboardingStatus" SET DEFAULT 'DRAFT',
ALTER COLUMN "onboardingStatus" SET NOT NULL;

-- AlterTable
ALTER TABLE "VendorUser"
ALTER COLUMN "email" DROP NOT NULL,
ADD COLUMN "mobile" TEXT;

-- CreateTable
CREATE TABLE "VendorRegistrationInvite" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveryStatus" "VendorRegistrationInviteDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "deliveryError" TEXT,
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorRegistrationInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_mobile_key" ON "Vendor"("mobile");

-- CreateIndex
CREATE INDEX "Vendor_onboardingStatus_createdAt_idx" ON "Vendor"("onboardingStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Vendor_approvedByAdminId_idx" ON "Vendor"("approvedByAdminId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorUser_mobile_key" ON "VendorUser"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "VendorRegistrationInvite_tokenHash_key" ON "VendorRegistrationInvite"("tokenHash");

-- Prevent concurrent requests from dispatching more than one unresolved SMS.
CREATE UNIQUE INDEX "VendorRegistrationInvite_one_active_pending_per_vendor"
ON "VendorRegistrationInvite"("vendorId")
WHERE "deliveryStatus" = 'PENDING'
  AND "usedAt" IS NULL
  AND "revokedAt" IS NULL;

-- CreateIndex
CREATE INDEX "VendorRegistrationInvite_vendorId_createdAt_idx" ON "VendorRegistrationInvite"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "VendorRegistrationInvite_createdByAdminId_createdAt_idx" ON "VendorRegistrationInvite"("createdByAdminId", "createdAt");

-- CreateIndex
CREATE INDEX "VendorRegistrationInvite_expiresAt_idx" ON "VendorRegistrationInvite"("expiresAt");

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_approvedByAdminId_fkey" FOREIGN KEY ("approvedByAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorRegistrationInvite" ADD CONSTRAINT "VendorRegistrationInvite_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorRegistrationInvite" ADD CONSTRAINT "VendorRegistrationInvite_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
