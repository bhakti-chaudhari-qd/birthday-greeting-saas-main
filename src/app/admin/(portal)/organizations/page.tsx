import { AdminClientsListClient } from "@/components/admin/admin-clients-list-client";
import { listOrganizationsForPlatformAdmin } from "@/lib/admin/organizations";
import { listPlanCatalogueEntriesForPlatformAdmin } from "@/lib/admin/plan-catalogue-ops";
import type { PlanLabelMap } from "@/lib/billing/catalogue";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationsPage() {
  const [organizations, catalogueEntries] = await Promise.all([
    listOrganizationsForPlatformAdmin(),
    listPlanCatalogueEntriesForPlatformAdmin(),
  ]);
  const planLabels: PlanLabelMap = Object.fromEntries(
    catalogueEntries.map((entry) => [entry.plan, entry.label]),
  );

  return (
    <AdminClientsListClient organizations={organizations} planLabels={planLabels} />
  );
}
