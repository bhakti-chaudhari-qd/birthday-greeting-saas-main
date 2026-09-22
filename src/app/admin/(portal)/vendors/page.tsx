import Link from "next/link";

import {
  VendorLifecycleBadge,
  describeLatestVendorInvite,
  maskedVendorMobile,
} from "@/components/admin/vendor-lifecycle";
import { StatusBadge } from "@/components/ui/feedback";
import {
  PageHeader,
  PageShell,
  Panel,
  PrimaryButtonLink,
} from "@/components/ui/page";
import { listVendorsForPlatformAdmin } from "@/lib/admin/vendors";

export const dynamic = "force-dynamic";

export default async function AdminVendorsPage() {
  const vendors = await listVendorsForPlatformAdmin();

  return (
    <PageShell wide>
      <PageHeader
        title="Vendors"
        description="Manage channel partners from invitation through approval."
        actions={
          <PrimaryButtonLink href="/admin/vendors/new">
            Create vendor
          </PrimaryButtonLink>
        }
      />

      <Panel>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Mobile</th>
                <th className="px-4 py-3 font-medium">Lifecycle</th>
                <th className="px-4 py-3 font-medium">Latest invitation</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Users</th>
                <th className="px-4 py-3 font-medium">Referrals</th>
                <th className="px-4 py-3 font-medium">
                  Current active connections
                </th>
                <th className="px-4 py-3 font-medium">
                  Current-routed deliveries this month (IST)
                </th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-stone-500" colSpan={9}>
                    No vendors yet.
                  </td>
                </tr>
              ) : (
                vendors.map((vendor) => (
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
                      <VendorLifecycleBadge status={vendor.onboardingStatus} />
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-600">
                      {describeLatestVendorInvite(vendor.latestInvite)}
                    </td>
                    <td className="px-4 py-3">
                      {vendor.onboardingStatus === "APPROVED" ? (
                        <StatusBadge
                          label={vendor.isActive ? "Active" : "Suspended"}
                          tone={vendor.isActive ? "success" : "neutral"}
                        />
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{vendor.userCount}</td>
                    <td className="px-4 py-3">
                      {vendor.referredOrganizationCount}
                    </td>
                    <td className="px-4 py-3">
                      {vendor.currentActiveConnectedOrganizationCount}
                    </td>
                    <td className="px-4 py-3">
                      {vendor.currentRoutedDeliveriesThisMonth}
                      <p className="text-xs text-stone-500">
                        {vendor.currentRoutedMonthlyDeliverySuccessRatePercent ==
                        null
                          ? "No decided deliveries"
                          : `${vendor.currentRoutedMonthlyDeliverySuccessRatePercent}% success`}
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
