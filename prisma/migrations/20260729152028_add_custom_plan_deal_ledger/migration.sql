-- CreateEnum
CREATE TYPE "DealSource" AS ENUM ('DIRECT', 'RAZORPAY');

-- CreateEnum
CREATE TYPE "DealPaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- CreateTable
CREATE TABLE "CustomPlanDeal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "source" "DealSource" NOT NULL,
    "amountDuePaise" INTEGER NOT NULL,
    "amountPaidPaise" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "DealPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "durationDays" INTEGER NOT NULL,
    "contactLimit" INTEGER NOT NULL,
    "smsMonthlyLimit" INTEGER NOT NULL,
    "whatsappMonthlyLimit" INTEGER NOT NULL,
    "emailMonthlyLimit" INTEGER NOT NULL,
    "resultingPaidUntil" TIMESTAMP(3) NOT NULL,
    "billingCheckoutId" TEXT,
    "createdByAdminId" TEXT,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomPlanDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomPlanPayment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "note" TEXT,
    "recordedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomPlanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomPlanDeal_billingCheckoutId_key" ON "CustomPlanDeal"("billingCheckoutId");

-- CreateIndex
CREATE INDEX "CustomPlanDeal_organizationId_activatedAt_idx" ON "CustomPlanDeal"("organizationId", "activatedAt");

-- CreateIndex
CREATE INDEX "CustomPlanPayment_organizationId_createdAt_idx" ON "CustomPlanPayment"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomPlanDeal" ADD CONSTRAINT "CustomPlanDeal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomPlanDeal" ADD CONSTRAINT "CustomPlanDeal_billingCheckoutId_fkey" FOREIGN KEY ("billingCheckoutId") REFERENCES "BillingCheckout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomPlanDeal" ADD CONSTRAINT "CustomPlanDeal_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomPlanPayment" ADD CONSTRAINT "CustomPlanPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomPlanPayment" ADD CONSTRAINT "CustomPlanPayment_recordedByAdminId_fkey" FOREIGN KEY ("recordedByAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
