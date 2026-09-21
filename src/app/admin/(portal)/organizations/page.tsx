import Link from "next/link";

import { StatusBadge } from "@/components/ui/feedback";
import { PageHeader, PageShell, Panel } from "@/components/ui/page";
import { listOrganizationsForPlatformAdmin } from "@/lib/admin/organizations";
import { listPlanCatalogueEntriesForPlatformAdmin } from "@/lib/admin/plan-catalogue-ops";
import { getPlanDisplayLabel, type PlanLabelMap } from "@/lib/billing/catalogue";

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
    <PageShell wide>
      <PageHeader
        title="Clients"
        description="All clients on the platform. Open a row to manage status, plan, limits, and users."
      />

      <Panel>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Health</th>
                <th className="px-4 py-3 font-medium">Messaging</th>
              </tr>
            </thead>
            <tbody>
              {organizations.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-stone-500" colSpan={4}>
                    No clients yet.
                  </td>
                </tr>
              ) : (
                organizations.map((org) => (
                  <tr key={org.id} className="border-b border-stone-100">
                    <td className="px-4 py-3 font-medium text-stone-900">
                      <Link
                        href={`/admin/organizations/${org.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {org.name}
                      </Link>
                      <p className="mt-1 text-xs font-normal text-stone-500">
                        {org.plan ? getPlanDisplayLabel(org.plan, planLabels) : "No plan"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {org.connectedVendors.length > 0 ? (
                        <div className="flex flex-wrap gap-x-2 gap-y-1">
                          {org.connectedVendors.map((vendor) => (
                            <Link
                              key={vendor.id}
                              href={`/admin/vendors/${vendor.id}`}
                              className="font-medium text-stone-800 hover:text-primary hover:underline"
                            >
                              {vendor.name}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p>No connected vendor</p>
                      )}
                      <p className="mt-1 text-xs text-stone-500">
                        {org.referredVendor
                          ? `Referred by ${org.referredVendor.name}`
                          : "No referral"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={org.health.label.replace("_", " ")}
                        tone={
                          org.health.label === "HEALTHY"
                            ? "success"
                            : org.health.label === "NEEDS_ATTENTION"
                              ? "warning"
                              : "neutral"
                        }
                      />
                      <p className="mt-1 max-w-52 text-xs text-stone-500">
                        {org.health.reasons[0]}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      <p>
                        {org.monthlyDeliverySuccessRatePercent == null
                          ? "No deliveries"
                          : `${org.monthlyDeliverySuccessRatePercent}% success`}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {org.monthlyDeliveryFailureCount} failed ·{" "}
                        {org.queuePendingCount} queued
                        {org.queueFailedCount > 0
                          ? ` · ${org.queueFailedCount} need retry`
                          : ""}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </PageShell>
  );
}
