import { notFound } from "next/navigation";

import { AdminClientDetailClient } from "@/components/admin/admin-client-detail-client";
import { listPlatformAdminAuditEventsForOrganization } from "@/lib/admin/audit";
import { listFailedQueueDiagnosticsForPlatformAdmin } from "@/lib/admin/failed-queue";
import { getOrganizationForPlatformAdmin } from "@/lib/admin/org-ops";
import { listPlanCatalogueEntriesForPlatformAdmin } from "@/lib/admin/plan-catalogue-ops";
import type { PlanLabelMap } from "@/lib/billing/catalogue";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminOrganizationDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  const organization = await getOrganizationForPlatformAdmin(id);

  if (!organization) {
    notFound();
  }

  const [failedQueueItems, recentActivity, catalogueEntries] = await Promise.all([
    listFailedQueueDiagnosticsForPlatformAdmin(organization.id),
    listPlatformAdminAuditEventsForOrganization(organization.id, 15),
    listPlanCatalogueEntriesForPlatformAdmin(),
  ]);
  const planLabels: PlanLabelMap = Object.fromEntries(
    catalogueEntries.map((entry) => [entry.plan, entry.label]),
  );

  return (
    <AdminClientDetailClient
      organization={organization}
      failedQueueItems={failedQueueItems}
      recentActivity={recentActivity}
      planLabels={planLabels}
    />
  );
}
