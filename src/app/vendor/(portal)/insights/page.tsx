import { redirect } from "next/navigation";

import { PortalStatGrid } from "@/components/portal/portal-stat-grid";
import { PageHeader, PageShell, Panel } from "@/components/ui/page";
import { getVendorAuthContext } from "@/lib/auth/vendor-session";
import { getVendorDeliveryInsights } from "@/lib/vendor/insights";
import { formatCustomerDateTime } from "@/lib/ui/datetime";

export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export default async function VendorInsightsPage() {
  const vendor = await getVendorAuthContext();
  if (!vendor) {
    redirect("/login");
  }

  const insights = await getVendorDeliveryInsights(vendor.vendorId);

  return (
    <PageShell wide>
      <PageHeader
        title="Delivery insights"
        description={`Volumes for ${vendor.vendorName}'s current active organization/channel routes. These are not historical vendor-attribution metrics. No client contact details are shown here.`}
      />

      <PortalStatGrid
        stats={[
          {
            label: "Current-routed this month",
            value: formatNumber(insights.currentRoutedDeliveriesThisMonth),
          },
          {
            label: "Current-routed today",
            value: formatNumber(insights.currentRoutedDeliveriesToday),
          },
          {
            label: "Current-routed successful",
            value: formatNumber(insights.currentRoutedSuccessCount),
            hint: "Submitted, delivered, or read",
          },
          {
            label: "Current-routed failed",
            value: formatNumber(insights.currentRoutedFailureCount),
            hint: "Failed or undelivered",
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-stone-900">By status</h2>
          {insights.currentRoutedStatusBreakdown.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">
              No current-routed deliveries this month.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {insights.currentRoutedStatusBreakdown.map((row) => (
                <li
                  key={row.status}
                  className="flex items-center justify-between border-b border-stone-100 pb-2 last:border-0 last:pb-0"
                >
                  <span className="text-stone-700">{row.status}</span>
                  <span className="font-medium text-stone-900">
                    {formatNumber(row.count)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-stone-900">By channel</h2>
          {insights.currentRoutedChannelBreakdown.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">
              No current-routed deliveries this month.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {insights.currentRoutedChannelBreakdown.map((row) => (
                <li
                  key={row.channel}
                  className="flex items-center justify-between border-b border-stone-100 pb-2 last:border-0 last:pb-0"
                >
                  <span className="text-stone-700">{row.channel}</span>
                  <span className="font-medium text-stone-900">
                    {formatNumber(row.count)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel>
        <div className="border-b border-stone-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-900">
            Recent current-routed deliveries
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Channel</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {insights.currentRoutedRecentDeliveries.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-stone-500" colSpan={5}>
                    No deliveries match this vendor&apos;s current active routes.
                  </td>
                </tr>
              ) : (
                insights.currentRoutedRecentDeliveries.map((row) => (
                  <tr key={row.id} className="border-b border-stone-100">
                    <td className="px-4 py-3 font-medium text-stone-900">
                      {row.organizationName}
                    </td>
                    <td className="px-4 py-3 text-stone-600">{row.channel}</td>
                    <td className="px-4 py-3 text-stone-700">{row.status}</td>
                    <td className="px-4 py-3 text-stone-600">
                      {formatCustomerDateTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-stone-500">
                      {row.errorMessage ?? "-"}
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
