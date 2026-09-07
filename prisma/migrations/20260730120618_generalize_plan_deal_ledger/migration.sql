-- Rename CustomPlanDeal -> PlanDeal (generalizes beyond CUSTOM plans; data preserved)
ALTER TABLE "CustomPlanDeal" RENAME TO "PlanDeal";
ALTER TABLE "PlanDeal" RENAME CONSTRAINT "CustomPlanDeal_pkey" TO "PlanDeal_pkey";
ALTER TABLE "PlanDeal" RENAME CONSTRAINT "CustomPlanDeal_organizationId_fkey" TO "PlanDeal_organizationId_fkey";
ALTER TABLE "PlanDeal" RENAME CONSTRAINT "CustomPlanDeal_billingCheckoutId_fkey" TO "PlanDeal_billingCheckoutId_fkey";
ALTER TABLE "PlanDeal" RENAME CONSTRAINT "CustomPlanDeal_createdByAdminId_fkey" TO "PlanDeal_createdByAdminId_fkey";
ALTER INDEX "CustomPlanDeal_billingCheckoutId_key" RENAME TO "PlanDeal_billingCheckoutId_key";
ALTER INDEX "CustomPlanDeal_organizationId_activatedAt_idx" RENAME TO "PlanDeal_organizationId_activatedAt_idx";

-- Rename CustomPlanPayment -> PlanPayment (data preserved)
ALTER TABLE "CustomPlanPayment" RENAME TO "PlanPayment";
ALTER TABLE "PlanPayment" RENAME CONSTRAINT "CustomPlanPayment_pkey" TO "PlanPayment_pkey";
ALTER TABLE "PlanPayment" RENAME CONSTRAINT "CustomPlanPayment_organizationId_fkey" TO "PlanPayment_organizationId_fkey";
ALTER TABLE "PlanPayment" RENAME CONSTRAINT "CustomPlanPayment_recordedByAdminId_fkey" TO "PlanPayment_recordedByAdminId_fkey";
ALTER INDEX "CustomPlanPayment_organizationId_createdAt_idx" RENAME TO "PlanPayment_organizationId_createdAt_idx";

-- Generalize PlanDeal beyond CUSTOM: every existing row is a CUSTOM deal, so
-- backfilling with a default and dropping it afterward is safe and exact.
ALTER TABLE "PlanDeal" ADD COLUMN "plan" "SubscriptionPlan" NOT NULL DEFAULT 'CUSTOM';
ALTER TABLE "PlanDeal" ALTER COLUMN "plan" DROP DEFAULT;

-- Per-channel limits are CUSTOM-only going forward; STARTER/PRO deals use the
-- new aggregate monthlyMessageLimit column instead.
ALTER TABLE "PlanDeal" ALTER COLUMN "smsMonthlyLimit" DROP NOT NULL;
ALTER TABLE "PlanDeal" ALTER COLUMN "whatsappMonthlyLimit" DROP NOT NULL;
ALTER TABLE "PlanDeal" ALTER COLUMN "emailMonthlyLimit" DROP NOT NULL;
ALTER TABLE "PlanDeal" ADD COLUMN "monthlyMessageLimit" INTEGER;
