"use client";

import Link from "next/link";
import { useId, useState } from "react";

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
import type { PlatformOverviewStats } from "@/lib/admin/overview";
import type { PlatformUsageSnapshot } from "@/lib/admin/org-ops";
import type { PlatformPlanAlerts } from "@/lib/admin/plan-alerts";
import type { PlatformOrganizationSummary } from "@/lib/admin/organizations";
import type { PlatformVendorSummary } from "@/lib/admin/vendors";
import { getAdminOverviewDict } from "@/lib/i18n/dictionaries/admin-overview";
import { useLocale } from "@/lib/i18n/use-locale";
import { formatDisplayDate } from "@/lib/ui/datetime";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

/**
 * Overview KPI card whose list stays closed until the header is clicked.
 * With a count of 0 there is nothing to open, so it shows the empty text.
 */
function AlertListCard({
  title,
  hint,
  count,
  emptyText,
  viewLabel,
  hideLabel,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  emptyText: string;
  viewLabel: string;
  hideLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const header = (
    <>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
        <p className="mt-1 text-xs text-stone-500">{hint}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <p className="text-2xl font-semibold text-stone-900">{formatNumber(count)}</p>
        {count > 0 ? (
          <span className="text-xs font-medium text-primary">
            {open ? hideLabel : viewLabel} {open ? "▴" : "▾"}
          </span>
        ) : null}
      </div>
    </>
  );

  return (
    <Panel className="p-5">
      {count > 0 ? (
        <button
          type="button"
          className="-m-2 flex w-[calc(100%+1rem)] items-start justify-between gap-3 rounded-lg p-2 text-left outline-none hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-primary"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((current) => !current)}
        >
          {header}
        </button>
      ) : (
        <div className="flex items-start justify-between gap-3">{header}</div>
      )}
      {count === 0 ? (
        <p className="mt-3 text-sm text-stone-500">{emptyText}</p>
      ) : open ? (
        <div id={listId}>{children}</div>
      ) : null}
    </Panel>
  );
}

export type AdminOverviewClientProps = {
  stats: PlatformOverviewStats;
  usage: PlatformUsageSnapshot;
  organizations: PlatformOrganizationSummary[];
  vendors: PlatformVendorSummary[];
  planAlerts: PlatformPlanAlerts;
};

export function AdminOverviewClient({
  stats,
  usage,
  organizations,
  vendors,
  planAlerts,
}: AdminOverviewClientProps) {
  const locale = useLocale();
  const dict = getAdminOverviewDict(locale);

  const preview = organizations.slice(0, 5);
  const vendorPreview = vendors.slice(0, 5);
  const activeVendorCount = vendors.filter(
    (vendor) => vendor.onboardingStatus === "APPROVED" && vendor.isActive,
  ).length;

  return (
    <PageShell wide>
      <PageHeader
        title={dict.title}
        description={dict.description}
        actions={
          <PrimaryButtonLink href="/admin/organizations">
            {dict.viewClients}
          </PrimaryButtonLink>
        }
      />

      <PortalStatGrid
        stats={[
          {
            label: dict.stat.clients,
            value: formatNumber(stats.organizationCount),
            hint: dict.stat.clientsHint(
              formatNumber(stats.activeOrganizationCount),
              formatNumber(stats.inactiveOrganizationCount),
            ),
          },
          {
            label: dict.stat.users,
            value: formatNumber(stats.userCount),
            hint: dict.stat.usersHint,
          },
          {
            label: dict.stat.contacts,
            value: formatNumber(stats.contactCount),
            hint: dict.stat.contactsHint,
          },
          {
            label: dict.stat.messagesThisMonth,
            value: formatNumber(stats.messagesSentThisMonth),
            hint: dict.stat.messagesThisMonthHint,
          },
        ]}
      />

      <PortalStatGrid
        stats={[
          {
            label: dict.stat.deliveriesToday,
            value: formatNumber(usage.deliveriesToday),
          },
          {
            label: dict.stat.deliveriesThisMonth,
            value: formatNumber(usage.deliveriesThisMonth),
          },
          {
            label: dict.stat.successRate,
            value:
              usage.successRatePercent == null
                ? "-"
                : `${usage.successRatePercent}%`,
            hint: dict.stat.successRateHint(
              formatNumber(usage.successCount),
              formatNumber(usage.failureCount),
            ),
          },
          {
            label: dict.stat.queue,
            value: formatNumber(usage.queuePending),
            hint: dict.stat.queueHint(
              formatNumber(usage.queueSending),
              formatNumber(usage.queueFailedStuck),
            ),
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AlertListCard
          title={dict.expiringPlansTitle(planAlerts.warningDays)}
          hint={dict.expiringPlansHint}
          count={planAlerts.expiringPlans.length}
          emptyText={dict.noExpiringPlans}
          viewLabel={dict.viewList}
          hideLabel={dict.hideList}
        >
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm">
            {planAlerts.expiringPlans.map((alert) => (
              <li
                key={alert.organizationId}
                className="flex items-center justify-between gap-3 border-b border-stone-100 pb-2 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <Link
                    href={`/admin/organizations/${alert.organizationId}`}
                    className="font-medium text-stone-900 hover:text-primary"
                  >
                    {alert.organizationName}
                  </Link>
                  <p className="text-xs text-stone-500">
                    {alert.plan} · {dict.endsOn(formatDisplayDate(alert.paidUntil))}
                  </p>
                </div>
                <StatusBadge
                  label={dict.daysLeft(alert.daysLeft)}
                  tone={alert.daysLeft <= 3 ? "danger" : "warning"}
                />
              </li>
            ))}
          </ul>
        </AlertListCard>

        <AlertListCard
          title={dict.exhaustedTitle}
          hint={dict.exhaustedHint}
          count={planAlerts.exhaustedChannels.length}
          emptyText={dict.noExhausted}
          viewLabel={dict.viewList}
          hideLabel={dict.hideList}
        >
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm">
            {planAlerts.exhaustedChannels.map((alert) => (
              <li
                key={alert.organizationId}
                className="border-b border-stone-100 pb-2 last:border-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/admin/organizations/${alert.organizationId}`}
                    className="font-medium text-stone-900 hover:text-primary"
                  >
                    {alert.organizationName}
                  </Link>
                  <span className="text-xs text-stone-500">{alert.plan}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {alert.limits.map((limit) => (
                    <StatusBadge
                      key={limit.channel}
                      tone="danger"
                      label={`${
                        limit.channel === "ALL"
                          ? dict.allChannels
                          : dict.channel[limit.channel]
                      } ${formatNumber(limit.used)}/${formatNumber(limit.limit)}`}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </AlertListCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-stone-900">{dict.planMix}</h2>
          {stats.planBreakdown.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">{dict.noSubscriptionsYet}</p>
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
              {dict.clientsPanelTitle}
            </h2>
            <Link
              href="/admin/organizations"
              className="text-sm font-medium text-primary hover:underline"
            >
              {dict.viewAll}
            </Link>
          </div>
          {preview.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">{dict.noClientsYet}</p>
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
                      {org.slug} · {org.plan ?? dict.noPlan}
                    </p>
                  </div>
                  <StatusBadge
                    label={org.isActive ? dict.active : dict.inactive}
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
              <h2 className="text-sm font-semibold text-stone-900">
                {dict.vendorsPanelTitle}
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                {dict.vendorsCountHint(
                  formatNumber(vendors.length),
                  formatNumber(activeVendorCount),
                )}
              </p>
            </div>
            <Link
              href="/admin/vendors"
              className="text-sm font-medium text-primary hover:underline"
            >
              {dict.viewAll}
            </Link>
          </div>
          {vendorPreview.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">{dict.noVendorsYet}</p>
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
                      {dict.usersCount(formatNumber(vendor.userCount))} ·{" "}
                      {dict.referralsCount(
                        formatNumber(vendor.referredOrganizationCount),
                      )}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {describeLatestVendorInvite(
                        vendor.latestInvite,
                        new Date(),
                        locale,
                      )}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {dict.currentActiveConnections(
                        formatNumber(vendor.currentActiveConnectedOrganizationCount),
                      )}
                      {" · "}
                      {dict.currentRoutedDeliveries(
                        formatNumber(vendor.currentRoutedDeliveriesThisMonth),
                      )}
                      {" · "}
                      {vendor.currentRoutedMonthlyDeliverySuccessRatePercent == null
                        ? dict.noDecidedDeliveries
                        : dict.successPercent(
                            vendor.currentRoutedMonthlyDeliverySuccessRatePercent,
                          )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <VendorLifecycleBadge status={vendor.onboardingStatus} locale={locale} />
                    {vendor.onboardingStatus === "APPROVED" ? (
                      <StatusBadge
                        label={vendor.isActive ? dict.active : dict.suspended}
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
