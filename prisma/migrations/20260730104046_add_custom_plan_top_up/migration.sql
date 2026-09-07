-- CreateTable
CREATE TABLE "CustomPlanTopUp" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "messagesAdded" INTEGER NOT NULL,
    "resultingMonthlyLimit" INTEGER NOT NULL,
    "amountDuePaise" INTEGER NOT NULL,
    "amountPaidPaise" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "DealPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "source" "DealSource" NOT NULL DEFAULT 'DIRECT',
    "billingCheckoutId" TEXT,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomPlanTopUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomPlanTopUp_billingCheckoutId_key" ON "CustomPlanTopUp"("billingCheckoutId");

-- CreateIndex
CREATE INDEX "CustomPlanTopUp_organizationId_createdAt_idx" ON "CustomPlanTopUp"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomPlanTopUp" ADD CONSTRAINT "CustomPlanTopUp_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomPlanTopUp" ADD CONSTRAINT "CustomPlanTopUp_billingCheckoutId_fkey" FOREIGN KEY ("billingCheckoutId") REFERENCES "BillingCheckout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomPlanTopUp" ADD CONSTRAINT "CustomPlanTopUp_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
