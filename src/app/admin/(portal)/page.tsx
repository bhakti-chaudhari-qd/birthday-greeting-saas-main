import { AdminOverviewClient } from "@/components/admin/admin-overview-client";
import { getPlatformOverviewStats } from "@/lib/admin/overview";
import { getPlatformUsageSnapshot } from "@/lib/admin/org-ops";
import { listOrganizationsForPlatformAdmin } from "@/lib/admin/organizations";
import { listVendorsForPlatformAdmin } from "@/lib/admin/vendors";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const [stats, usage, organizations, vendors] = await Promise.all([
    getPlatformOverviewStats(),
    getPlatformUsageSnapshot(),
    listOrganizationsForPlatformAdmin(),
    listVendorsForPlatformAdmin(),
  ]);

  return (
    <AdminOverviewClient
      stats={stats}
      usage={usage}
      organizations={organizations}
      vendors={vendors}
    />
  );
}
