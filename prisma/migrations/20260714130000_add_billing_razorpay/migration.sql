-- CreateTable
CREATE TABLE "BillingCheckout" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "razorpayEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "organizationId" TEXT,
    "payload" JSONB NOT NULL,
    "processNote" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingCheckout_razorpayOrderId_key" ON "BillingCheckout"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "BillingCheckout_organizationId_createdAt_idx" ON "BillingCheckout"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_razorpayEventId_key" ON "BillingEvent"("razorpayEventId");

-- CreateIndex
CREATE INDEX "BillingEvent_organizationId_idx" ON "BillingEvent"("organizationId");

-- CreateIndex
CREATE INDEX "BillingEvent_eventType_processedAt_idx" ON "BillingEvent"("eventType", "processedAt");

-- AddForeignKey
ALTER TABLE "BillingCheckout" ADD CONSTRAINT "BillingCheckout_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
