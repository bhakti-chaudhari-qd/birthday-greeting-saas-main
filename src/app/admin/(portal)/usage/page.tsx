import Link from "next/link";

import { PortalStatGrid } from "@/components/portal/portal-stat-grid";
import { StatusBadge } from "@/components/ui/feedback";
import { PageHeader, PageShell, Panel } from "@/components/ui/page";
import { getPlatformUsageSnapshot } from "@/lib/admin/org-ops";
import { getCustomerDeliveryStatusLabel } from "@/lib/ui/customer-labels";

export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export default async function AdminUsagePage() {
  const usage = await getPlatformUsageSnapshot();

  return (
    <PageShell wide>
      <PageHeader
        title="Usage"
        description="Platform-wide delivery health, queue pressure, and tenants near their limits. No client contact details are shown. All time frames below (today, this month) are Indian Standard Time (IST)."
      />

      <PortalStatGrid
        stats={[
          {
            label: "Deliveries today",
            value: formatNumber(usage.deliveriesToday),
            hint: "Since midnight IST",
          },
          {
            label: "Deliveries this month",
            value: formatNumber(usage.deliveriesThisMonth),
            hint: "Since the 1st of this month, IST",
          },
          {
            label: "Successful this month",
            value: formatNumber(usage.successCount),
            hint: "Submitted, delivered, or read",
          },
          {
            label: "Failed this month",
            value: formatNumber(usage.failureCount),
            hint: "Failed or not delivered",
          },
        ]}
      />
      <p className="text-xs text-stone-500">
        Successful ({formatNumber(usage.successCount)}) + Failed (
        {formatNumber(usage.failureCount)}) + still sending (
        {formatNumber(usage.queuedCount)}) = Deliveries this month (
        {formatNumber(usage.deliveriesThisMonth)}).
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-stone-900">
            Queue right now
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            Live counts, not a monthly total - unrelated to &quot;Failed this
            month&quot; above, which counts finished attempts instead
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between border-b border-stone-100 pb-2">
              <span className="text-stone-700">Pending</span>
              <span className="font-medium">
                {formatNumber(usage.queuePending)}
              </span>
            </li>
            <li className="flex justify-between border-b border-stone-100 pb-2">
              <span className="text-stone-700">Sending</span>
              <span className="font-medium">
                {formatNumber(usage.queueSending)}
              </span>
            </li>
            <li className="flex justify-between border-b border-stone-100 pb-2">
              <span className="text-stone-700">
                Failed - will retry automatically
              </span>
              <span className="font-medium">
                {formatNumber(usage.queueFailedRetryable)}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-stone-700">Failed - needs attention</span>
              <span className="font-medium">
                {formatNumber(usage.queueFailedStuck)}
              </span>
            </li>
          </ul>
        </Panel>

        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-stone-900">
            By status
          </h2>
          <p className="mt-1 text-xs text-stone-500">This month, IST</p>
          {usage.statusBreakdown.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No deliveries yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {usage.statusBreakdown.map((row) => (
                <li
                  key={row.status}
                  className="flex justify-between border-b border-stone-100 pb-2 last:border-0 last:pb-0"
                >
                  <span className="text-stone-700">
                    {getCustomerDeliveryStatusLabel(row.status)}
                  </span>
                  <span className="font-medium">
                    {formatNumber(row.count)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-stone-900">
            By channel
          </h2>
          <p className="mt-1 text-xs text-stone-500">This month, IST</p>
          {usage.channelBreakdown.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No deliveries yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {usage.channelBreakdown.map((row) => (
                <li
                  key={row.channel}
                  className="flex justify-between border-b border-stone-100 pb-2 last:border-0 last:pb-0"
                >
                  <span className="text-stone-700">{row.channel}</span>
                  <span className="font-medium">
                    {formatNumber(row.count)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <div className="border-b border-stone-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-900">
              Near contact limit (≥80%)
            </h2>
            {usage.nearContactLimitTotal > usage.nearContactLimit.length ? (
              <p className="mt-1 text-xs text-stone-500">
                Showing {usage.nearContactLimit.length} of{" "}
                {usage.nearContactLimitTotal}
              </p>
            ) : null}
          </div>
          <LimitTable rows={usage.nearContactLimit} kind="contacts" />
        </Panel>
        <Panel>
          <div className="border-b border-stone-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-900">
              Near message limit (≥80% of this month&apos;s limit)
            </h2>
            {usage.nearMessageLimitTotal > usage.nearMessageLimit.length ? (
              <p className="mt-1 text-xs text-stone-500">
                Showing {usage.nearMessageLimit.length} of{" "}
                {usage.nearMessageLimitTotal}
              </p>
            ) : null}
          </div>
          <LimitTable rows={usage.nearMessageLimit} kind="messages" />
        </Panel>
      </div>
    </PageShell>
  );
}

function LimitTable({
  rows,
  kind,
}: {
  rows: Awaited<ReturnType<typeof getPlatformUsageSnapshot>>["nearContactLimit"];
  kind: "contacts" | "messages";
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
          <tr>
            <th className="px-4 py-3 font-medium">Client</th>
            <th className="px-4 py-3 font-medium">Usage</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-stone-500" colSpan={3}>
                No clients near this limit.
              </td>
            </tr>
          ) : (
            rows.map((org) => {
              const used =
                kind === "contacts"
                  ? org.contactCount
                  : (org.messagesSentThisMonth ?? 0);
              const limit =
                kind === "contacts"
                  ? org.contactLimit
                  : org.monthlyMessageLimit;
              return (
                <tr key={org.id} className="border-b border-stone-100">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/organizations/${org.id}`}
                      className="font-medium text-stone-900 hover:text-primary"
                    >
                      {org.name}
                    </Link>
                    <p className="text-xs text-stone-500">{org.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-stone-700">
                    {used}
                    {limit != null ? ` / ${limit}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={org.isActive ? "Active" : "Inactive"}
                      tone={org.isActive ? "success" : "neutral"}
                    />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
