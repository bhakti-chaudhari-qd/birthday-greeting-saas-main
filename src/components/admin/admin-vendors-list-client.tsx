"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  VendorLifecycleBadge,
  describeLatestVendorInvite,
  maskedVendorMobile,
} from "@/components/admin/vendor-lifecycle";
import { ListPagination, paginate } from "@/components/admin/list-pagination";
import { StatusBadge } from "@/components/ui/feedback";
import {
  PageHeader,
  PageShell,
  Panel,
  PrimaryButtonLink,
  inputClass,
} from "@/components/ui/page";
import type { PlatformVendorSummary } from "@/lib/admin/vendors";
import { getAdminListControlsDict } from "@/lib/i18n/dictionaries/admin-list-controls";
import { getAdminVendorsListDict } from "@/lib/i18n/dictionaries/admin-vendors-list";
import { useLocale } from "@/lib/i18n/use-locale";

export function AdminVendorsListClient({
  vendors,
}: {
  vendors: PlatformVendorSummary[];
}) {
  const locale = useLocale();
  const dict = getAdminVendorsListDict(locale);
  const controls = getAdminListControlsDict(locale);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return vendors;
    return vendors.filter(
      (vendor) =>
        vendor.name.toLowerCase().includes(query) ||
        (vendor.mobile ?? "").includes(query),
    );
  }, [vendors, search]);

  const { pageItems, totalPages, currentPage } = paginate(filtered, page);

  return (
    <PageShell wide>
      <PageHeader
        title={dict.title}
        description={dict.description}
        actions={
          <PrimaryButtonLink href="/admin/vendors/new">
            {dict.createVendor}
          </PrimaryButtonLink>
        }
      />

      <Panel className="p-4">
        <label className="block text-sm">
          <span className="sr-only">{controls.searchVendors}</span>
          <input
            className={inputClass}
            placeholder={controls.searchVendors}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </Panel>

      <Panel>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">{dict.colName}</th>
                <th className="px-4 py-3 font-medium">{dict.colMobile}</th>
                <th className="px-4 py-3 font-medium">{dict.colLifecycle}</th>
                <th className="px-4 py-3 font-medium">{dict.colLatestInvitation}</th>
                <th className="px-4 py-3 font-medium">{dict.colAccount}</th>
                <th className="px-4 py-3 font-medium">{dict.colUsers}</th>
                <th className="px-4 py-3 font-medium">{dict.colReferrals}</th>
                <th className="px-4 py-3 font-medium">
                  {dict.colCurrentActiveConnections}
                </th>
                <th className="px-4 py-3 font-medium">
                  {dict.colCurrentRoutedDeliveries}
                </th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-stone-500" colSpan={9}>
                    {dict.noVendorsYet}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-stone-500" colSpan={9}>
                    {controls.noMatches}
                  </td>
                </tr>
              ) : (
                pageItems.map((vendor) => (
                  <tr key={vendor.id} className="border-b border-stone-100">
                    <td className="px-4 py-3 font-medium text-stone-900">
                      <Link
                        href={`/admin/vendors/${vendor.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {vendor.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {maskedVendorMobile(vendor.mobile)}
                    </td>
                    <td className="px-4 py-3">
                      <VendorLifecycleBadge status={vendor.onboardingStatus} locale={locale} />
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-600">
                      {describeLatestVendorInvite(vendor.latestInvite, new Date(), locale)}
                    </td>
                    <td className="px-4 py-3">
                      {vendor.onboardingStatus === "APPROVED" ? (
                        <StatusBadge
                          label={vendor.isActive ? dict.active : dict.suspended}
                          tone={vendor.isActive ? "success" : "neutral"}
                        />
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{vendor.userCount}</td>
                    <td className="px-4 py-3">{vendor.referredOrganizationCount}</td>
                    <td className="px-4 py-3">
                      {vendor.currentActiveConnectedOrganizationCount}
                    </td>
                    <td className="px-4 py-3">
                      {vendor.currentRoutedDeliveriesThisMonth}
                      <p className="text-xs text-stone-500">
                        {vendor.currentRoutedMonthlyDeliverySuccessRatePercent == null
                          ? dict.noDecidedDeliveries
                          : dict.successPercent(
                              vendor.currentRoutedMonthlyDeliverySuccessRatePercent,
                            )}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {vendors.length > 0 ? (
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
