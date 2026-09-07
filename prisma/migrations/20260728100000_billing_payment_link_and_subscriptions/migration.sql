-- Payment-link deal fields + subscription id on checkout rows
ALTER TABLE "BillingCheckout" ADD COLUMN IF NOT EXISTS "dealContactLimit" INTEGER;
ALTER TABLE "BillingCheckout" ADD COLUMN IF NOT EXISTS "dealMonthlyMessageLimit" INTEGER;
ALTER TABLE "BillingCheckout" ADD COLUMN IF NOT EXISTS "durationDays" INTEGER;
ALTER TABLE "BillingCheckout" ADD COLUMN IF NOT EXISTS "razorpaySubscriptionId" TEXT;

CREATE INDEX IF NOT EXISTS "BillingCheckout_razorpaySubscriptionId_idx" ON "BillingCheckout"("razorpaySubscriptionId");
