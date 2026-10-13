import { requirePlatformAdmin } from "@/lib/auth/platform-admin-guard";
import { AdminPlanCatalogueClient } from "@/components/admin/admin-plan-catalogue-client";
import { DailySummaryConfigPanel } from "@/components/admin/daily-summary-config-panel";
import { PageShell } from "@/components/ui/page";
import { listPlanCatalogueEntriesForPlatformAdmin } from "@/lib/admin/plan-catalogue-ops";
import { getPlatformDailySummarySettings } from "@/lib/daily-summary/platform-config";

export const dynamic = "force-dynamic";

export default async function AdminPlanCataloguePage() {
  await requirePlatformAdmin();

  const [entries, dailySummary] = await Promise.all([
    listPlanCatalogueEntriesForPlatformAdmin(),
    getPlatformDailySummarySettings(),
  ]);

  return (
    <>
      <AdminPlanCatalogueClient entries={entries} />
      <PageShell>
        <DailySummaryConfigPanel initial={dailySummary} />
      </PageShell>
    </>
  );
}
