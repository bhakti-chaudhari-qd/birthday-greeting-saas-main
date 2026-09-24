"use client";

import { Suspense } from "react";

import { AddClientContactsPanel } from "@/components/admin/add-client-contacts-panel";
import { AddOrganizationUserForm } from "@/components/admin/add-organization-user-form";
import { ChannelTopUpPanel } from "@/components/admin/channel-top-up-panel";
import { DealHistoryPanel } from "@/components/admin/deal-history-panel";
import { FailedQueueTable } from "@/components/admin/failed-queue-table";
import { OrganizationDetailTabs } from "@/components/admin/organization-detail-tabs";
import { OrganizationOpsForm } from "@/components/admin/organization-ops-form";
import { OrganizationUsersTable } from "@/components/admin/organization-users-table";
import { PaymentLinksPanel } from "@/components/admin/payment-links-panel";
import { PlanActivationForm } from "@/components/admin/plan-activation-form";
import { RecordPaymentPanel } from "@/components/admin/record-payment-panel";
import { StatusBadge } from "@/components/ui/feedback";
import {
  PageHeader,
  PageShell,
  Panel,
  SecondaryButtonLink,
} from "@/components/ui/page";
import type { PlatformAdminAuditListItem } from "@/lib/admin/audit";
import type { PlatformFailedQueueDiagnostic } from "@/lib/admin/failed-queue";
import type { PlatformOrganizationDetail } from "@/lib/admin/org-ops";
import { formatInrFromPaise, type PlanLabelMap } from "@/lib/billing/catalogue";
import { getAdminClientDetailDict } from "@/lib/i18n/dictionaries/admin-client-detail";
import {
  translateHealthLabel,
  translateHealthReason,
} from "@/lib/i18n/dictionaries/admin-health";
import { useLocale } from "@/lib/i18n/use-locale";
import { formatCustomerDateTime, formatDisplayDate } from "@/lib/ui/datetime";

type AdminClientDetailClientProps = {
  organization: PlatformOrganizationDetail;
  failedQueueItems: PlatformFailedQueueDiagnostic[];
  recentActivity: PlatformAdminAuditListItem[];
  planLabels: PlanLabelMap;
};

export function AdminClientDetailClient({
  organization,
  failedQueueItems,
  recentActivity,
  planLabels,
}: AdminClientDetailClientProps) {
  const locale = useLocale();
  const dict = getAdminClientDetailDict(locale);

  const overviewTab = (
    <>
      <Panel className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">
              {dict.overview.clientHealth}
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-stone-600">
              {organization.health.reasons.map((reason) => (
                <li key={reason.code}>
                  • {translateHealthReason(reason, locale)}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-stone-500">
                {dict.overview.executableRoutes}
              </p>
              <p className="font-semibold text-stone-900">
                {organization.executableAutomationRouteCount} /{" "}
                {organization.enabledAutomationRouteCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">
                {dict.overview.categoryRules}
              </p>
              <p className="font-semibold text-stone-900">
                {organization.categoryRuleCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">
                {dict.overview.deliveryThisMonth}
              </p>
              <p className="font-semibold text-stone-900">
                {organization.monthlyDeliverySuccessCount} {dict.overview.ok} ·{" "}
                {organization.monthlyDeliveryFailureCount} {dict.overview.failed}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">
                {dict.overview.queueRightNow}
              </p>
              <p className="font-semibold text-stone-900">
                {organization.queuePendingCount} {dict.overview.pending} ·{" "}
                {organization.queueFailedStuckCount} {dict.overview.stuck}
                {organization.queueFailedRetryableCount > 0
                  ? ` · ${organization.queueFailedRetryableCount} ${dict.overview.retrying}`
                  : ""}
              </p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-stone-500">
          {dict.overview.activeConfiguredChannels}:{" "}
          {organization.configuredChannels.join(", ") || dict.overview.none}
          {" · "}
          {dict.overview.successRateThisMonth}:{" "}
          {organization.monthlyDeliverySuccessRatePercent == null
            ? dict.overview.noDecidedDeliveries
            : `${organization.monthlyDeliverySuccessRatePercent}%`}
        </p>
        {organization.executableAutomationRoutes.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2 text-xs text-stone-700">
            {organization.executableAutomationRoutes.map((route, index) => (
              <li
                key={`${route.source}-${route.occasionId}-${route.channel}-${route.categoryName ?? "default"}-${index}`}
                className="rounded-full bg-stone-100 px-2.5 py-1 ring-1 ring-inset ring-stone-200"
              >
                {route.categoryName ? `${route.categoryName} · ` : ""}
                {route.occasionName} · {route.channel}
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>

      <Panel>
        <div className="border-b border-stone-200 px-5 py-3 sm:px-6">
          <h2 className="text-sm font-semibold text-stone-900">
            {dict.overview.clientSettings}
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            {dict.overview.clientSettingsDescription}
          </p>
        </div>
        <OrganizationOpsForm organization={organization} />
      </Panel>
    </>
  );

  const billingTab = (
    <>
      <Panel>
        <div className="border-b border-stone-200 px-5 py-3 sm:px-6">
          <h2 className="text-sm font-semibold text-stone-900">
            {dict.billing.activatePlan}
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            {dict.billing.activatePlanDescription}
          </p>
        </div>
        <PlanActivationForm organization={organization} planLabels={planLabels} />
      </Panel>

      <Panel>
        <div className="border-b border-stone-200 px-5 py-3 sm:px-6">
          <h2 className="text-sm font-semibold text-stone-900">
            {dict.billing.dealHistory}
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            {dict.billing.dealHistoryDescription}
          </p>
        </div>
        <DealHistoryPanel
          deals={organization.planLedger.deals}
          planLabels={planLabels}
        />
      </Panel>

      <Panel>
        <div className="border-b border-stone-200 px-5 py-3 sm:px-6">
          <h2 className="text-sm font-semibold text-stone-900">
            {dict.billing.channelTopUps}
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            {dict.billing.channelTopUpsDescription}
          </p>
        </div>
        <ChannelTopUpPanel
          organizationId={organization.id}
          topUps={organization.planLedger.topUps}
          channelLimits={organization.channelLimits}
        />
      </Panel>

      <Panel>
        <div className="border-b border-stone-200 px-5 py-3 sm:px-6">
          <h2 className="text-sm font-semibold text-stone-900">
            {dict.billing.recordPayment}
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            {dict.billing.recordPaymentDescription}
          </p>
        </div>
        <RecordPaymentPanel
          organizationId={organization.id}
          payments={organization.planLedger.payments}
        />
      </Panel>

      <Panel>
        <div className="border-b border-stone-200 px-5 py-3 sm:px-6">
          <h2 className="text-sm font-semibold text-stone-900">
            {dict.billing.paymentLinks}
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            {dict.billing.paymentLinksDescription}
          </p>
        </div>
        <PaymentLinksPanel
          organizationId={organization.id}
          paymentLinks={organization.paymentLinks}
          planLabels={planLabels}
        />
      </Panel>
    </>
  );

  const activityTab = (
    <>
      <Panel>
        <div className="border-b border-stone-200 px-5 py-3 sm:px-6">
          <h2 className="text-sm font-semibold text-stone-900">
            {dict.activity.failedQueueDiagnostics}
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            {dict.activity.failedQueueDescription}
          </p>
        </div>
        <FailedQueueTable
          organizationId={organization.id}
          items={failedQueueItems}
        />
      </Panel>

      <Panel>
        <div className="border-b border-stone-200 px-5 py-3 sm:px-6">
          <h2 className="text-sm font-semibold text-stone-900">
            {dict.activity.recentActivity}
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            {dict.activity.recentActivityDescription}
          </p>
        </div>
        {recentActivity.length === 0 ? (
          <p className="px-5 py-4 text-sm text-stone-500">
            {dict.activity.noActivity}
          </p>
        ) : (
          <ul className="divide-y divide-stone-200">
            {recentActivity.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-stone-900">
                    {event.action
                      .toLowerCase()
                      .split("_")
                      .map(
                        (part) =>
                          part.charAt(0).toUpperCase() + part.slice(1),
                      )
                      .join(" ")}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {event.actorName ?? dict.activity.deletedAdmin} ·{" "}
                    {event.targetType.replace("_", " ")} {event.targetId}
                  </p>
                </div>
                <time
                  dateTime={event.createdAt}
                  className="text-xs text-stone-500"
                >
                  {formatCustomerDateTime(event.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );

  const usersTab = (
    <Panel>
      <div className="border-b border-stone-200 px-5 py-3 sm:px-6">
        <h2 className="text-sm font-semibold text-stone-900">
          {dict.tabs.users}
        </h2>
        <p className="mt-0.5 text-sm text-stone-600">
          {dict.page.usersTabDescription}
        </p>
      </div>
      <AddOrganizationUserForm organizationId={organization.id} />
      <OrganizationUsersTable
        organizationId={organization.id}
        users={organization.users}
      />
    </Panel>
  );

  const contactsTab = (
    <Panel>
      <div className="border-b border-stone-200 px-5 py-3 sm:px-6">
        <h2 className="text-sm font-semibold text-stone-900">
          {dict.contactsTab.title}
        </h2>
        <p className="mt-0.5 text-sm text-stone-600">
          {dict.contactsTab.description}
        </p>
      </div>
      <div className="px-5 py-4 sm:px-6">
        <AddClientContactsPanel organizationId={organization.id} />
      </div>
    </Panel>
  );

  return (
    <PageShell>
      <PageHeader
        title={organization.name}
        description={`${organization.slug} · ${dict.page.created} ${formatDisplayDate(organization.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={organization.isActive ? dict.page.active : dict.page.inactive}
              tone={organization.isActive ? "success" : "neutral"}
            />
            <StatusBadge
              label={translateHealthLabel(organization.health.label, locale)}
              tone={
                organization.health.label === "HEALTHY"
                  ? "success"
                  : organization.health.label === "NEEDS_ATTENTION"
                    ? "warning"
                    : "neutral"
              }
            />
            <SecondaryButtonLink href="/admin/organizations">
              {dict.page.backToList}
            </SecondaryButtonLink>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Panel className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            {dict.page.contacts}
          </p>
          <p className="mt-1 text-xl font-semibold text-stone-900">
            {organization.contactCount}
            {organization.contactLimit != null
              ? ` / ${organization.contactLimit}`
              : ""}
          </p>
        </Panel>
        <Panel className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            {dict.page.messagesThisMonth}
          </p>
          <p className="mt-1 text-xl font-semibold text-stone-900">
            {organization.messagesSentThisMonth ?? 0}
            {organization.monthlyMessageLimit != null
              ? ` / ${organization.monthlyMessageLimit}`
              : ""}
          </p>
          {organization.channelLimits.length > 0 ? (
            <p className="mt-1 text-xs text-stone-500">
              {organization.channelLimits
                .map(
                  (limit) =>
                    `${limit.channel}: ${limit.messagesSentThisMonth} / ${limit.monthlyLimit}`,
                )
                .join(" · ")}
            </p>
          ) : null}
        </Panel>
        <Panel className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            {dict.page.users}
          </p>
          <p className="mt-1 text-xl font-semibold text-stone-900">
            {organization.userCount}
          </p>
        </Panel>
        <Panel className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            {dict.page.outstandingBalance}
          </p>
          <p
            className={`mt-1 text-xl font-semibold ${
              organization.planLedger.outstandingBalancePaise > 0
                ? "text-red-700"
                : "text-emerald-700"
            }`}
          >
            {formatInrFromPaise(organization.planLedger.outstandingBalancePaise)}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {dict.page.outstandingBalanceHint}
          </p>
        </Panel>
      </div>

      <Suspense
        fallback={
          <Panel className="p-5">
            <p className="text-sm text-stone-500">{dict.page.loading}</p>
          </Panel>
        }
      >
        <OrganizationDetailTabs
          overview={overviewTab}
          billing={billingTab}
          activity={activityTab}
          users={usersTab}
          contacts={contactsTab}
        />
      </Suspense>
    </PageShell>
  );
}
