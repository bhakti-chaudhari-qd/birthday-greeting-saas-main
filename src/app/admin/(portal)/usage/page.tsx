import Link from "next/link";

import { PortalStatGrid } from "@/components/portal/portal-stat-grid";
import { StatusBadge } from "@/components/ui/feedback";
import { PageHeader, PageShell, Panel } from "@/components/ui/page";
import { getPlatformUsageSnapshot } from "@/lib/admin/org-ops";

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
        description="Platform-wide delivery health, queue pressure, and tenants near their limits. No organization contact details are shown."
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
            label: "Successful",
            value: formatNumber(usage.successCount),
            hint: "Submitted, delivered, or read",
          },
          {
            label: "Failed",
            value: formatNumber(usage.failureCount),
            hint: "Failed or undelivered",
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-stone-900">Queue depth</h2>
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
            <li className="flex justify-between">
              <span className="text-stone-700">Failed</span>
              <span className="font-medium">
                {formatNumber(usage.queueFailed)}
              </span>
            </li>
          </ul>
        </Panel>

        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-stone-900">
            By status (month)
          </h2>
          {usage.statusBreakdown.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">No deliveries yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {usage.statusBreakdown.map((row) => (
                <li
                  key={row.status}
                  className="flex justify-between border-b border-stone-100 pb-2 last:border-0 last:pb-0"
                >
                  <span className="text-stone-700">{row.status}</span>
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
            By channel (month)
          </h2>
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
          </div>
          <LimitTable rows={usage.nearContactLimit} kind="contacts" />
        </Panel>
        <Panel>
          <div className="border-b border-stone-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-900">
              Near message limit (≥80%)
            </h2>
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
            <th className="px-4 py-3 font-medium">Organization</th>
            <th className="px-4 py-3 font-medium">Usage</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-stone-500" colSpan={3}>
                No organizations near this limit.
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
