import { requirePlatformAdmin } from "@/lib/auth/platform-admin-guard";
import { DailySummaryConfigPanel } from "@/components/admin/daily-summary-config-panel";
import { TomorrowListConfigPanel } from "@/components/admin/tomorrow-list-config-panel";
import { PageHeader, PageShell } from "@/components/ui/page";
import { getPlatformDailySummarySettings } from "@/lib/daily-summary/platform-config";
import {
  DEFAULT_TOMORROW_LIST_BUTTON_TEXT,
  DEFAULT_TOMORROW_LIST_TEMPLATE_BODY,
  DEFAULT_TOMORROW_LIST_TEMPLATE_NAME,
} from "@/lib/tomorrow-list/meta-template";
import { getPlatformTomorrowListSettings } from "@/lib/tomorrow-list/platform-config";

export const dynamic = "force-dynamic";

export default async function AdminDailySummaryPage() {
  await requirePlatformAdmin();

  const [dailySummary, tomorrowList] = await Promise.all([
    getPlatformDailySummarySettings(),
    getPlatformTomorrowListSettings(),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Daily Summary & Tomorrow's List"
        description="The WhatsApp account, templates and send times for every client Owner's daily summary and day-before Tomorrow's List."
      />
      <DailySummaryConfigPanel initial={dailySummary} />
      <div id="tomorrow-list" className="mt-6">
        <TomorrowListConfigPanel
          initial={tomorrowList}
          defaults={{
            templateName: DEFAULT_TOMORROW_LIST_TEMPLATE_NAME,
            body: DEFAULT_TOMORROW_LIST_TEMPLATE_BODY,
            buttonText: DEFAULT_TOMORROW_LIST_BUTTON_TEXT,
            baseUrl: (process.env.PLATFORM_APP_URL ?? "").replace(/\/+$/, ""),
          }}
        />
      </div>
    </PageShell>
  );
}
