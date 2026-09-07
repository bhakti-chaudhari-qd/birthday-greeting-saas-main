-- CreateTable
CREATE TABLE "PlanCatalogueRecord" (
    "plan" "SubscriptionPlan" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "contactLimit" INTEGER NOT NULL,
    "monthlyMessageLimit" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByAdminId" TEXT,

    CONSTRAINT "PlanCatalogueRecord_pkey" PRIMARY KEY ("plan")
);

-- AddForeignKey
ALTER TABLE "PlanCatalogueRecord" ADD CONSTRAINT "PlanCatalogueRecord_updatedByAdminId_fkey" FOREIGN KEY ("updatedByAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default STARTER/PRO catalogue rows (mirrors PLAN_CATALOGUE defaults in src/lib/billing/catalogue.ts)
INSERT INTO "PlanCatalogueRecord" ("plan", "label", "description", "amountPaise", "contactLimit", "monthlyMessageLimit", "updatedAt")
VALUES
  ('STARTER', 'Starter', 'Higher limits and live Custom HTTP when ACTIVE.', 49900, 1000, 10000, CURRENT_TIMESTAMP),
  ('PRO', 'Pro', 'Higher monthly send capacity for growing teams.', 149900, 10000, 100000, CURRENT_TIMESTAMP);
