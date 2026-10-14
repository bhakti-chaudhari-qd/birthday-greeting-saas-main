import { requirePlatformAdmin } from "@/lib/auth/platform-admin-guard";
import { DailySummaryConfigPanel } from "@/components/admin/daily-summary-config-panel";
import { PageHeader, PageShell } from "@/components/ui/page";
import { getPlatformDailySummarySettings } from "@/lib/daily-summary/platform-config";

export const dynamic = "force-dynamic";

export default async function AdminDailySummaryPage() {
  await requirePlatformAdmin();

  const dailySummary = await getPlatformDailySummarySettings();

  return (
    <PageShell>
      <PageHeader
        title="Daily Summary"
        description="The WhatsApp account, template and send time for every client Owner's daily summary."
      />
      <DailySummaryConfigPanel initial={dailySummary} />
    </PageShell>
  );
}
