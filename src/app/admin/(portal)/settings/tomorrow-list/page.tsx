import { requirePlatformAdmin } from "@/lib/auth/platform-admin-guard";
import { TomorrowListConfigPanel } from "@/components/admin/tomorrow-list-config-panel";
import { PageHeader, PageShell } from "@/components/ui/page";
import { getPlatformTomorrowListSettings } from "@/lib/tomorrow-list/platform-config";

export const dynamic = "force-dynamic";

export default async function AdminTomorrowListPage() {
  await requirePlatformAdmin();

  const settings = await getPlatformTomorrowListSettings();

  return (
    <PageShell>
      <PageHeader
        title="Tomorrow's List"
        description="The WhatsApp template and default send time for every client's day-before list link."
      />
      <TomorrowListConfigPanel initial={settings} />
    </PageShell>
  );
}
