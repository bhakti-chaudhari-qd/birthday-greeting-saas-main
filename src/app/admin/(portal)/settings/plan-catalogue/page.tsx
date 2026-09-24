import { AdminPlanCatalogueClient } from "@/components/admin/admin-plan-catalogue-client";
import { listPlanCatalogueEntriesForPlatformAdmin } from "@/lib/admin/plan-catalogue-ops";

export const dynamic = "force-dynamic";

export default async function AdminPlanCataloguePage() {
  const entries = await listPlanCatalogueEntriesForPlatformAdmin();

  return <AdminPlanCatalogueClient entries={entries} />;
}
