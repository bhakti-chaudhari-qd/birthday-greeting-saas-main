import Link from "next/link";

import {
  VendorLifecycleBadge,
  describeLatestVendorInvite,
  maskedVendorMobile,
} from "@/components/admin/vendor-lifecycle";
import { PortalStatGrid } from "@/components/portal/portal-stat-grid";
import { StatusBadge } from "@/components/ui/feedback";
import {
  PageHeader,
  PageShell,
  Panel,
  PrimaryButtonLink,
} from "@/components/ui/page";
import { getPlatformOverviewStats } from "@/lib/admin/overview";
import { getPlatformUsageSnapshot } from "@/lib/admin/org-ops";
import { listOrganizationsForPlatformAdmin } from "@/lib/admin/organizations";
import { listVendorsForPlatformAdmin } from "@/lib/admin/vendors";

export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export default async function AdminHomePage() {
  const [stats, usage, organizations, vendors] = await Promise.all([
    getPlatformOverviewStats(),
    getPlatformUsageSnapshot(),
    listOrganizationsForPlatformAdmin(),
    listVendorsForPlatformAdmin(),
  ]);

  const preview = organizations.slice(0, 5);
  const vendorPreview = vendors.slice(0, 5);
  const activeVendorCount = vendors.filter(
    (vendor) =>
      vendor.onboardingStatus === "APPROVED" && vendor.isActive,
  ).length;

  return (
    <PageShell wide>
      <PageHeader
        title="Overview"
        description="Platform snapshot across all organizations. Organization workspaces stay separate from this portal."
        actions={
          <PrimaryButtonLink href="/admin/organizations">
            View organizations
          </PrimaryButtonLink>
        }
      />

      <PortalStatGrid
        stats={[
          {
            label: "Organizations",
            value: formatNumber(stats.organizationCount),
            hint: `${formatNumber(stats.activeOrganizationCount)} active · ${formatNumber(stats.inactiveOrganizationCount)} inactive`,
          },
          {
            label: "Users",
            value: formatNumber(stats.userCount),
            hint: "Across all organizations",
          },
          {
            label: "Contacts",
            value: formatNumber(stats.contactCount),
            hint: "Stored in Organization portals",
          },
          {
            label: "Messages this month",
            value: formatNumber(stats.messagesSentThisMonth),
            hint: "Sum of subscription counters",
          },
        ]}
      />

      <PortalStatGrid
        stats={[
          {
            label: "Deliveries today",
            value: formatNumber(usage.deliveriesToday),
          },
          {
            label: "Deliveries this month",
            value: formatNumber(usage.deliveriesThisMonth),
          },
          {
            label: "Success rate",
            value:
              usage.successRatePercent == null
                ? "-"
                : `${usage.successRatePercent}%`,
            hint: `${formatNumber(usage.successCount)} ok · ${formatNumber(usage.failureCount)} failed`,
          },
          {
            label: "Queue",
            value: formatNumber(usage.queuePending),
            hint: `${formatNumber(usage.queueSending)} sending · ${formatNumber(usage.queueFailed)} failed`,
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-stone-900">Plan mix</h2>
          {stats.planBreakdown.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No subscriptions yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {stats.planBreakdown.map((row) => (
                <li
                  key={row.plan}
                  className="flex items-center justify-between border-b border-stone-100 pb-2 last:border-0 last:pb-0"
                >
                  <span className="text-stone-700">{row.plan}</span>
                  <span className="font-medium text-stone-900">
                    {formatNumber(row.count)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-stone-900">
              Organizations
            </h2>
            <Link
              href="/admin/organizations"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {preview.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No organizations yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {preview.map((org) => (
                <li
                  key={org.id}
                  className="flex items-center justify-between gap-3 border-b border-stone-100 pb-2 last:border-0 last:pb-0"
                >
                  <div>
                    <Link
                      href={`/admin/organizations/${org.id}`}
                      className="font-medium text-stone-900 hover:text-primary"
                    >
                      {org.name}
                    </Link>
                    <p className="text-xs text-stone-500">
                      {org.slug} · {org.plan ?? "No plan"}
                    </p>
                  </div>
                  <StatusBadge
                    label={org.isActive ? "Active" : "Inactive"}
                    tone={org.isActive ? "success" : "neutral"}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-stone-900">Vendors</h2>
              <p className="mt-1 text-xs text-stone-500">
                {formatNumber(vendors.length)} total ·{" "}
                {formatNumber(activeVendorCount)} approved and active
              </p>
            </div>
            <Link
              href="/admin/vendors"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {vendorPreview.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No vendors yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {vendorPreview.map((vendor) => (
                <li
                  key={vendor.id}
                  className="flex items-center justify-between gap-3 border-b border-stone-100 pb-2 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/vendors/${vendor.id}`}
                      className="font-medium text-stone-900 hover:text-primary"
                    >
                      {vendor.name}
                    </Link>
                    <p className="truncate text-xs text-stone-500">
                      {maskedVendorMobile(vendor.mobile)} ·{" "}
                      {formatNumber(vendor.userCount)} users ·{" "}
                      {formatNumber(vendor.referredOrganizationCount)} referrals
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {describeLatestVendorInvite(vendor.latestInvite)}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {formatNumber(
                        vendor.currentActiveConnectedOrganizationCount,
                      )}{" "}
                      current active connections
                      {" · "}
                      {formatNumber(
                        vendor.currentRoutedDeliveriesThisMonth,
                      )}{" "}
                      current-routed deliveries this month
                      {" · "}
                      {vendor.currentRoutedMonthlyDeliverySuccessRatePercent ==
                      null
                        ? "No success rate"
                        : `${vendor.currentRoutedMonthlyDeliverySuccessRatePercent}% success`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <VendorLifecycleBadge status={vendor.onboardingStatus} />
                    {vendor.onboardingStatus === "APPROVED" ? (
                      <StatusBadge
                        label={vendor.isActive ? "Active" : "Suspended"}
                        tone={vendor.isActive ? "success" : "neutral"}
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}
