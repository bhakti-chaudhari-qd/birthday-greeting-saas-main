"use client";

import Link from "next/link";

import {
  VendorLifecycleBadge,
  describeLatestVendorInvite,
  maskedVendorMobile,
} from "@/components/admin/vendor-lifecycle";
import { VendorAdminForm } from "@/components/admin/vendor-admin-form";
import { InlineAlert, StatusBadge } from "@/components/ui/feedback";
import { PageHeader, PageShell, Panel } from "@/components/ui/page";
import type { PlatformAdminAuditListItem } from "@/lib/admin/audit";
import type { PlatformVendorDetail } from "@/lib/admin/vendors";
import { getAdminVendorDetailDict } from "@/lib/i18n/dictionaries/admin-vendor-detail";
import { useLocale } from "@/lib/i18n/use-locale";
import { formatCustomerDateTime } from "@/lib/ui/datetime";

export type AdminVendorDetailClientProps = {
  vendor: PlatformVendorDetail;
  auditEvents: PlatformAdminAuditListItem[];
  inviteIssue?: string;
};

export function AdminVendorDetailClient({
  vendor,
  auditEvents,
  inviteIssue,
}: AdminVendorDetailClientProps) {
  const locale = useLocale();
  const dict = getAdminVendorDetailDict(locale);

  return (
    <PageShell>
      <PageHeader
        title={vendor.name}
        description={`Slug ${vendor.slug} · ${vendor.referredOrganizationCount} referred · ${vendor.currentActiveConnectedOrganizationCount} current active connections`}
        actions={
          <Link
            href="/admin/vendors"
            className="text-sm font-medium text-primary hover:underline"
          >
            {dict.backToVendors}
          </Link>
        }
      />

      {inviteIssue ? (
        <InlineAlert tone="warning">
          {dict.vendorWasCreatedBut(inviteIssue)}
        </InlineAlert>
      ) : null}

      <Panel className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <VendorLifecycleBadge status={vendor.onboardingStatus} locale={locale} />
          {vendor.onboardingStatus === "APPROVED" ? (
            <StatusBadge
              label={vendor.isActive ? dict.active : dict.suspended}
              tone={vendor.isActive ? "success" : "neutral"}
            />
          ) : null}
        </div>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-stone-500">{dict.mobile}</dt>
            <dd className="mt-1 font-medium text-stone-900">
              {maskedVendorMobile(vendor.mobile)}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">{dict.latestInvitation}</dt>
            <dd className="mt-1 font-medium text-stone-900">
              {describeLatestVendorInvite(vendor.latestInvite, new Date(), locale)}
            </dd>
            {vendor.latestInvite?.deliveryError ? (
              <dd className="mt-0.5 text-xs text-red-700">
                {vendor.latestInvite.deliveryError}
              </dd>
            ) : null}
          </div>
          <div>
            <dt className="text-stone-500">{dict.registrationSubmittedIst}</dt>
            <dd className="mt-1 font-medium text-stone-900">
              {vendor.registrationSubmittedAt
                ? formatCustomerDateTime(vendor.registrationSubmittedAt)
                : dict.notSubmitted}
            </dd>
          </div>
        </dl>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            {dict.currentActiveConnections}
          </p>
          <p className="mt-1 text-xl font-semibold text-stone-900">
            {vendor.currentActiveConnectedOrganizationCount}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {dict.currentActiveConnectionsHint}
          </p>
        </Panel>
        <Panel className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            {dict.currentRoutedDeliveriesThisMonthIst}
          </p>
          <p className="mt-1 text-xl font-semibold text-stone-900">
            {vendor.currentRoutedDeliveriesThisMonth}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {dict.okFailed(
              String(vendor.currentRoutedMonthlyDeliverySuccessCount),
              String(vendor.currentRoutedMonthlyDeliveryFailureCount),
            )}
          </p>
        </Panel>
        <Panel className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            {dict.currentRoutedSuccessRateThisMonthIst}
          </p>
          <p className="mt-1 text-xl font-semibold text-stone-900">
            {vendor.currentRoutedMonthlyDeliverySuccessRatePercent == null
              ? dict.noDecidedDeliveries
              : `${vendor.currentRoutedMonthlyDeliverySuccessRatePercent}%`}
          </p>
        </Panel>
      </div>

      <Panel className="p-5">
        <VendorAdminForm vendor={vendor} />
      </Panel>

      <Panel className="p-5">
        <h2 className="text-sm font-semibold text-stone-900">
          {dict.recentOnboardingActivity}
        </h2>
        {auditEvents.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">{dict.noActivityRecorded}</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
            {auditEvents.map((event) => (
              <li
                key={event.id}
                className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-stone-900">
                    {event.action
                      .replace(/^VENDOR_/, "")
                      .replaceAll("_", " ")
                      .toLowerCase()
                      .replace(/^\w/, (letter) => letter.toUpperCase())}
                  </p>
                  <p className="text-xs text-stone-500">
                    {event.actorName ?? dict.publicRegistration}
                  </p>
                </div>
                <time className="text-xs text-stone-500">
                  {formatCustomerDateTime(event.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageShell>
  );
}
