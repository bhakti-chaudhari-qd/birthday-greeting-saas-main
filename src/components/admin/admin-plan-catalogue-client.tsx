"use client";

import { PlanCatalogueEditor } from "@/components/admin/plan-catalogue-editor";
import { PageHeader, PageShell, Panel } from "@/components/ui/page";
import type { PlanCatalogueEntrySummary } from "@/lib/admin/plan-catalogue-ops";
import { getAdminPlanCatalogueDict } from "@/lib/i18n/dictionaries/admin-plan-catalogue";
import { useLocale } from "@/lib/i18n/use-locale";

export function AdminPlanCatalogueClient({
  entries,
}: {
  entries: PlanCatalogueEntrySummary[];
}) {
  const dict = getAdminPlanCatalogueDict(useLocale());

  return (
    <PageShell>
      <PageHeader title={dict.title} description={dict.description} />
      <Panel>
        <div className="border-b border-stone-200 px-5 py-3 sm:px-6">
          <p className="text-sm text-stone-600">
            {dict.intro("RAZORPAY_PLAN_STARTER", "RAZORPAY_PLAN_PRO")}
          </p>
        </div>
        <PlanCatalogueEditor entries={entries} />
      </Panel>
    </PageShell>
  );
}
