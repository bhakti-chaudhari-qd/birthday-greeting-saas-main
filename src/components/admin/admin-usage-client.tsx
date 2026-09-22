"use client";

import Link from "next/link";

import { PortalStatGrid } from "@/components/portal/portal-stat-grid";
import { StatusBadge } from "@/components/ui/feedback";
import { PageHeader, PageShell, Panel } from "@/components/ui/page";
import type { PlatformOrganizationSummary } from "@/lib/admin/organizations";
import type { PlatformUsageSnapshot } from "@/lib/admin/org-ops";
import { getAdminUsageDict } from "@/lib/i18n/dictionaries/admin-usage";
import { useLocale } from "@/lib/i18n/use-locale";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function AdminUsageClient({ usage }: { usage: PlatformUsageSnapshot }) {
  const locale = useLocale();
  const dict = getAdminUsageDict(locale);

  return (
    <PageShell wide>
      <PageHeader title={dict.title} description={dict.description} />

      <PortalStatGrid
        stats={[
          {
            label: dict.stat.deliveriesToday,
            value: formatNumber(usage.deliveriesToday),
            hint: dict.stat.deliveriesTodayHint,
          },
          {
            label: dict.stat.deliveriesThisMonth,
            value: formatNumber(usage.deliveriesThisMonth),
            hint: dict.stat.deliveriesThisMonthHint,
          },
          {
            label: dict.stat.successfulThisMonth,
            value: formatNumber(usage.successCount),
            hint: dict.stat.successfulThisMonthHint,
          },
          {
            label: dict.stat.failedThisMonth,
            value: formatNumber(usage.failureCount),
            hint: dict.stat.failedThisMonthHint,
          },
        ]}
      />
      <p className="text-xs text-stone-500">
        {dict.reconciliation(
          formatNumber(usage.successCount),
          formatNumber(usage.failureCount),
          formatNumber(usage.queuedCount),
          formatNumber(usage.deliveriesThisMonth),
        )}
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-stone-900">{dict.queue.title}</h2>
          <p className="mt-1 text-xs text-stone-500">{dict.queue.subtitle}</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between border-b border-stone-100 pb-2">
              <span className="text-stone-700">{dict.queue.pending}</span>
              <span className="font-medium">{formatNumber(usage.queuePending)}</span>
            </li>
            <li className="flex justify-between border-b border-stone-100 pb-2">
              <span className="text-stone-700">{dict.queue.sending}</span>
              <span className="font-medium">{formatNumber(usage.queueSending)}</span>
            </li>
            <li className="flex justify-between border-b border-stone-100 pb-2">
              <span className="text-stone-700">{dict.queue.failedRetryable}</span>
              <span className="font-medium">
                {formatNumber(usage.queueFailedRetryable)}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-stone-700">{dict.queue.failedStuck}</span>
              <span className="font-medium">{formatNumber(usage.queueFailedStuck)}</span>
            </li>
          </ul>
        </Panel>

        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-stone-900">{dict.byStatus.title}</h2>
          <p className="mt-1 text-xs text-stone-500">{dict.byStatus.subtitle}</p>
          {usage.statusBreakdown.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">{dict.byStatus.empty}</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {usage.statusBreakdown.map((row) => (
                <li
                  key={row.status}
                  className="flex justify-between border-b border-stone-100 pb-2 last:border-0 last:pb-0"
                >
                  <span className="text-stone-700">
                    {dict.deliveryStatusLabels[row.status] ?? row.status}
                  </span>
                  <span className="font-medium">{formatNumber(row.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-stone-900">{dict.byChannel.title}</h2>
          <p className="mt-1 text-xs text-stone-500">{dict.byChannel.subtitle}</p>
          {usage.channelBreakdown.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">{dict.byChannel.empty}</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {usage.channelBreakdown.map((row) => (
                <li
                  key={row.channel}
                  className="flex justify-between border-b border-stone-100 pb-2 last:border-0 last:pb-0"
                >
                  <span className="text-stone-700">{row.channel}</span>
                  <span className="font-medium">{formatNumber(row.count)}</span>
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
              {dict.nearContactLimit}
            </h2>
            {usage.nearContactLimitTotal > usage.nearContactLimit.length ? (
              <p className="mt-1 text-xs text-stone-500">
                {dict.showingOf(
                  usage.nearContactLimit.length,
                  formatNumber(usage.nearContactLimitTotal),
                )}
              </p>
            ) : null}
          </div>
          <LimitTable rows={usage.nearContactLimit} kind="contacts" dict={dict} />
        </Panel>
        <Panel>
          <div className="border-b border-stone-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-900">
              {dict.nearMessageLimit}
            </h2>
            {usage.nearMessageLimitTotal > usage.nearMessageLimit.length ? (
              <p className="mt-1 text-xs text-stone-500">
                {dict.showingOf(
                  usage.nearMessageLimit.length,
                  formatNumber(usage.nearMessageLimitTotal),
                )}
              </p>
            ) : null}
          </div>
          <LimitTable rows={usage.nearMessageLimit} kind="messages" dict={dict} />
        </Panel>
      </div>
    </PageShell>
  );
}

function LimitTable({
  rows,
  kind,
  dict,
}: {
  rows: PlatformOrganizationSummary[];
  kind: "contacts" | "messages";
  dict: ReturnType<typeof getAdminUsageDict>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
          <tr>
            <th className="px-4 py-3 font-medium">{dict.limitTable.client}</th>
            <th className="px-4 py-3 font-medium">{dict.limitTable.usage}</th>
            <th className="px-4 py-3 font-medium">{dict.limitTable.status}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-stone-500" colSpan={3}>
                {dict.limitTable.empty}
              </td>
            </tr>
          ) : (
            rows.map((org) => {
              const used =
                kind === "contacts"
                  ? org.contactCount
                  : (org.messagesSentThisMonth ?? 0);
              const limit =
                kind === "contacts" ? org.contactLimit : org.monthlyMessageLimit;
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
                      label={org.isActive ? dict.limitTable.active : dict.limitTable.inactive}
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
