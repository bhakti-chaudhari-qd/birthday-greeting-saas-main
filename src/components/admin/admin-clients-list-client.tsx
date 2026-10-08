"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ListPagination, paginate } from "@/components/admin/list-pagination";
import { StatusBadge } from "@/components/ui/feedback";
import {
  PageHeader,
  PageShell,
  Panel,
  PrimaryButtonLink,
  inputClass,
} from "@/components/ui/page";
import type { PlatformOrganizationSummary } from "@/lib/admin/organizations";
import { getPlanDisplayLabel, type PlanLabelMap } from "@/lib/billing/catalogue";
import { getAdminClientsListDict } from "@/lib/i18n/dictionaries/admin-clients-list";
import { translateHealthLabel, translateHealthReason } from "@/lib/i18n/dictionaries/admin-health";
import { getAdminListControlsDict } from "@/lib/i18n/dictionaries/admin-list-controls";
import { useLocale } from "@/lib/i18n/use-locale";
import { formatDisplayDate } from "@/lib/ui/datetime";

type StatusFilter = "all" | "active" | "inactive";
type SortOrder = "newest" | "oldest" | "name";

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
  const controls = getAdminListControlsDict(locale);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = organizations.filter((org) => {
      if (statusFilter === "active" && !org.isActive) return false;
      if (statusFilter === "inactive" && org.isActive) return false;
      return (
        !query ||
        org.name.toLowerCase().includes(query) ||
        org.slug.toLowerCase().includes(query)
      );
    });
    return matches.sort((a, b) => {
      if (sortOrder === "name") return a.name.localeCompare(b.name);
      const byDate = a.createdAt.localeCompare(b.createdAt);
      return sortOrder === "newest" ? -byDate : byDate;
    });
  }, [organizations, search, statusFilter, sortOrder]);

  const { pageItems, totalPages, currentPage } = paginate(filtered, page);

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

      <Panel className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="block min-w-0 flex-1 text-sm">
            <span className="sr-only">{controls.searchClients}</span>
            <input
              className={inputClass}
              placeholder={controls.searchClients}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            className={`${inputClass} sm:w-44`}
            aria-label={controls.statusAll}
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="all">{controls.statusAll}</option>
            <option value="active">{controls.statusActive}</option>
            <option value="inactive">{controls.statusInactive}</option>
          </select>
          <select
            className={`${inputClass} sm:w-44`}
            aria-label={controls.sortNewest}
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value as SortOrder);
              setPage(1);
            }}
          >
            <option value="newest">{controls.sortNewest}</option>
            <option value="oldest">{controls.sortOldest}</option>
            <option value="name">{controls.sortName}</option>
          </select>
        </div>
      </Panel>

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
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-stone-500" colSpan={4}>
                    {controls.noMatches}
                  </td>
                </tr>
              ) : (
                pageItems.map((org) => (
                  <tr key={org.id} className="border-b border-stone-100">
                    <td className="px-4 py-3 font-medium text-stone-900">
                      <Link
                        href={`/admin/organizations/${org.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {org.name}
                      </Link>
                      {!org.isActive ? (
                        <span className="ml-2 align-middle">
                          <StatusBadge label={controls.statusInactive} tone="neutral" />
                        </span>
                      ) : null}
                      <p className="mt-1 text-xs font-normal text-stone-500">
                        {org.plan ? getPlanDisplayLabel(org.plan, planLabels) : dict.noPlan}
                        {" · "}
                        {controls.contacts(formatNumber(org.contactCount))}
                      </p>
                      <p className="mt-0.5 text-xs font-normal text-stone-500">
                        {controls.signedUp(formatDisplayDate(org.createdAt))}
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
        {organizations.length > 0 ? (
          <ListPagination
            dict={controls}
            page={currentPage}
            totalPages={totalPages}
            shownCount={pageItems.length}
            totalCount={filtered.length}
            onPageChange={setPage}
          />
        ) : null}
      </Panel>
    </PageShell>
  );
}
