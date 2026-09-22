"use client";

import Link from "next/link";

import { StatusBadge } from "@/components/ui/feedback";
import {
  PageHeader,
  PageShell,
  Panel,
  PrimaryButtonLink,
} from "@/components/ui/page";
import type { PlatformOrganizationSummary } from "@/lib/admin/organizations";
import { getPlanDisplayLabel, type PlanLabelMap } from "@/lib/billing/catalogue";
import { getAdminClientsListDict } from "@/lib/i18n/dictionaries/admin-clients-list";
import { translateHealthLabel, translateHealthReason } from "@/lib/i18n/dictionaries/admin-health";
import { useLocale } from "@/lib/i18n/use-locale";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export type AdminClientsListClientProps = {
  organizations: PlatformOrganizationSummary[];
  planLabels: PlanLabelMap;
};

export function AdminClientsListClient({
  organizations,
  planLabels,
}: AdminClientsListClientProps) {
  const locale = useLocale();
  const dict = getAdminClientsListDict(locale);

  return (
    <PageShell wide>
      <PageHeader
        title={dict.title}
        description={dict.description}
        actions={
          <PrimaryButtonLink href="/admin/organizations/new">
            {dict.addClient}
          </PrimaryButtonLink>
        }
      />

      <Panel>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">{dict.colClient}</th>
                <th className="px-4 py-3 font-medium">{dict.colVendor}</th>
                <th className="px-4 py-3 font-medium">{dict.colHealth}</th>
                <th className="px-4 py-3 font-medium">{dict.colMessaging}</th>
              </tr>
            </thead>
            <tbody>
              {organizations.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-stone-500" colSpan={4}>
                    {dict.noClientsYet}
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
                        {org.plan ? getPlanDisplayLabel(org.plan, planLabels) : dict.noPlan}
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
                        <p>{dict.noConnectedVendor}</p>
                      )}
                      <p className="mt-1 text-xs text-stone-500">
                        {org.referredVendor
                          ? dict.referredBy(org.referredVendor.name)
                          : dict.noReferral}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={translateHealthLabel(org.health.label, locale)}
                        tone={
                          org.health.label === "HEALTHY"
                            ? "success"
                            : org.health.label === "NEEDS_ATTENTION"
                              ? "warning"
                              : "neutral"
                        }
                      />
                      <ul className="mt-1 max-w-52 space-y-0.5 text-xs text-stone-500">
                        {org.health.reasons.map((reason) => (
                          <li key={reason.code}>
                            {translateHealthReason(reason, locale)}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      <p>
                        {org.monthlyDeliverySuccessRatePercent == null
                          ? dict.noDeliveriesThisMonth
                          : dict.successThisMonth(org.monthlyDeliverySuccessRatePercent)}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {dict.failedThisMonth(formatNumber(org.monthlyDeliveryFailureCount))}{" "}
                        · {dict.queuedNow(formatNumber(org.queuePendingCount))}
                        {org.queueFailedStuckCount > 0
                          ? ` · ${dict.stuckNeedAttention(formatNumber(org.queueFailedStuckCount))}`
                          : ""}
                        {org.queueFailedRetryableCount > 0
                          ? ` · ${dict.retrying(formatNumber(org.queueFailedRetryableCount))}`
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
