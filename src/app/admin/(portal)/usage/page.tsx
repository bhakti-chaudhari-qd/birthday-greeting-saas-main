import { AdminUsageClient } from "@/components/admin/admin-usage-client";
import { getPlatformUsageSnapshot } from "@/lib/admin/org-ops";

export const dynamic = "force-dynamic";

export default async function AdminUsagePage() {
  const usage = await getPlatformUsageSnapshot();

  return <AdminUsageClient usage={usage} />;
}
