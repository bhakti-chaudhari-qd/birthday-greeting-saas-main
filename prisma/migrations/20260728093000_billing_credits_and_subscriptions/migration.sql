-- AlterTable Subscription: bonus credits, paid period, Razorpay subscription id
ALTER TABLE "Subscription" ADD COLUMN "bonusMessageCredits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN "paidUntil" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "razorpaySubscriptionId" TEXT;

CREATE UNIQUE INDEX "Subscription_razorpaySubscriptionId_key" ON "Subscription"("razorpaySubscriptionId");

-- CreateEnum
CREATE TYPE "BillingCheckoutKind" AS ENUM ('PLAN', 'CREDITS', 'PAYMENT_LINK');

-- AlterTable BillingCheckout: kind, optional plan, credit packs, payment link id
ALTER TABLE "BillingCheckout" ADD COLUMN "kind" "BillingCheckoutKind" NOT NULL DEFAULT 'PLAN';
ALTER TABLE "BillingCheckout" ADD COLUMN "creditMessages" INTEGER;
ALTER TABLE "BillingCheckout" ADD COLUMN "razorpayPaymentLinkId" TEXT;

ALTER TABLE "BillingCheckout" ALTER COLUMN "plan" DROP NOT NULL;

CREATE UNIQUE INDEX "BillingCheckout_razorpayPaymentLinkId_key" ON "BillingCheckout"("razorpayPaymentLinkId");
CREATE INDEX "BillingCheckout_kind_createdAt_idx" ON "BillingCheckout"("kind", "createdAt");
