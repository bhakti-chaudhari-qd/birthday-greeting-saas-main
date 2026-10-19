import { requirePlatformAdmin } from "@/lib/auth/platform-admin-guard";
import { AdminOverviewClient } from "@/components/admin/admin-overview-client";
import { getPlatformOverviewStats } from "@/lib/admin/overview";
import { getPlatformUsageSnapshot } from "@/lib/admin/org-ops";
import { getPlatformPlanAlerts } from "@/lib/admin/plan-alerts";
import { listOrganizationsForPlatformAdmin } from "@/lib/admin/organizations";
import { listVendorsForPlatformAdmin } from "@/lib/admin/vendors";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  await requirePlatformAdmin();

  const [stats, usage, organizations, vendors, planAlerts] = await Promise.all([
    getPlatformOverviewStats(),
    getPlatformUsageSnapshot(),
    listOrganizationsForPlatformAdmin(),
    listVendorsForPlatformAdmin(),
    getPlatformPlanAlerts(),
  ]);

  return (
    <AdminOverviewClient
      stats={stats}
      usage={usage}
      organizations={organizations}
      vendors={vendors}
      planAlerts={planAlerts}
    />
  );
}
