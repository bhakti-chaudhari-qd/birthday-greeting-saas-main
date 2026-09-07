import Link from "next/link";
import { notFound } from "next/navigation";

import {
  VendorLifecycleBadge,
  describeLatestVendorInvite,
  maskedVendorMobile,
} from "@/components/admin/vendor-lifecycle";
import { VendorAdminForm } from "@/components/admin/vendor-admin-form";
import { StatusBadge } from "@/components/ui/feedback";
import { PageHeader, PageShell, Panel } from "@/components/ui/page";
import { listPlatformAdminAuditEventsForVendor } from "@/lib/admin/audit";
import { getVendorForPlatformAdmin } from "@/lib/admin/vendors";
import { formatCustomerDateTime } from "@/lib/ui/datetime";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminVendorDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [vendor, auditEvents] = await Promise.all([
    getVendorForPlatformAdmin(id),
    listPlatformAdminAuditEventsForVendor(id, 12),
  ]);
  if (!vendor) {
    notFound();
  }

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
            Back to vendors
          </Link>
        }
      />

      <Panel className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <VendorLifecycleBadge status={vendor.onboardingStatus} />
          {vendor.onboardingStatus === "APPROVED" ? (
            <StatusBadge
              label={vendor.isActive ? "Active" : "Suspended"}
              tone={vendor.isActive ? "success" : "neutral"}
            />
          ) : null}
        </div>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-stone-500">Mobile</dt>
            <dd className="mt-1 font-medium text-stone-900">
              {maskedVendorMobile(vendor.mobile)}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Latest invitation</dt>
            <dd className="mt-1 font-medium text-stone-900">
              {describeLatestVendorInvite(vendor.latestInvite)}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Registration submitted</dt>
            <dd className="mt-1 font-medium text-stone-900">
              {vendor.registrationSubmittedAt
                ? new Date(vendor.registrationSubmittedAt).toLocaleString(
                    "en-IN",
                  )
                : "Not submitted"}
            </dd>
          </div>
        </dl>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Current active connections
          </p>
          <p className="mt-1 text-xl font-semibold text-stone-900">
            {vendor.currentActiveConnectedOrganizationCount}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Current active channel routing; distinct from referrals
          </p>
        </Panel>
        <Panel className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Current-routed deliveries this month
          </p>
          <p className="mt-1 text-xl font-semibold text-stone-900">
            {vendor.currentRoutedDeliveriesThisMonth}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {vendor.currentRoutedMonthlyDeliverySuccessCount} ok ·{" "}
            {vendor.currentRoutedMonthlyDeliveryFailureCount} failed
          </p>
        </Panel>
        <Panel className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Current-routed monthly success rate
          </p>
          <p className="mt-1 text-xl font-semibold text-stone-900">
            {vendor.currentRoutedMonthlyDeliverySuccessRatePercent == null
              ? "-"
              : `${vendor.currentRoutedMonthlyDeliverySuccessRatePercent}%`}
          </p>
        </Panel>
      </div>

      <Panel className="p-5">
        <VendorAdminForm vendor={vendor} />
      </Panel>

      <Panel className="p-5">
        <h2 className="text-sm font-semibold text-stone-900">
          Recent onboarding activity
        </h2>
        {auditEvents.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">No activity recorded.</p>
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
                    {event.actorName ?? "Public registration"}
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
