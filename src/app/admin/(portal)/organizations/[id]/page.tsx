import { Suspense } from "react";
import { notFound } from "next/navigation";

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
import { listPlatformAdminAuditEventsForOrganization } from "@/lib/admin/audit";
import { listFailedQueueDiagnosticsForPlatformAdmin } from "@/lib/admin/failed-queue";
import { getOrganizationForPlatformAdmin } from "@/lib/admin/org-ops";
import { listPlanCatalogueEntriesForPlatformAdmin } from "@/lib/admin/plan-catalogue-ops";
import { formatInrFromPaise, type PlanLabelMap } from "@/lib/billing/catalogue";
import { translateHealthReason } from "@/lib/i18n/dictionaries/admin-health";
import {
  formatCustomerDateTime,
  formatDisplayDate,
} from "@/lib/ui/datetime";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminOrganizationDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  const organization = await getOrganizationForPlatformAdmin(id);

  if (!organization) {
    notFound();
  }

  const [failedQueueItems, recentActivity, catalogueEntries] = await Promise.all([
    listFailedQueueDiagnosticsForPlatformAdmin(organization.id),
    listPlatformAdminAuditEventsForOrganization(organization.id, 15),
    listPlanCatalogueEntriesForPlatformAdmin(),
  ]);
  const planLabels: PlanLabelMap = Object.fromEntries(
    catalogueEntries.map((entry) => [entry.plan, entry.label]),
  );

  const overviewTab = (
    <>
      <Panel className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">
              Client health
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-stone-600">
              {organization.health.reasons.map((reason) => (
                <li key={reason.code}>
                  • {translateHealthReason(reason, "en")}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-stone-500">Executable routes</p>
              <p className="font-semibold text-stone-900">
                {organization.executableAutomationRouteCount} /{" "}
                {organization.enabledAutomationRouteCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Category rules</p>
              <p className="font-semibold text-stone-900">
                {organization.categoryRuleCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Delivery, this month (IST)</p>
              <p className="font-semibold text-stone-900">
                {organization.monthlyDeliverySuccessCount} ok ·{" "}
                {organization.monthlyDeliveryFailureCount} failed
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Queue right now</p>
              <p className="font-semibold text-stone-900">
                {organization.queuePendingCount} pending ·{" "}
                {organization.queueFailedStuckCount} stuck
                {organization.queueFailedRetryableCount > 0
                  ? ` · ${organization.queueFailedRetryableCount} retrying`
                  : ""}
              </p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-stone-500">
          Active configured channels:{" "}
          {organization.configuredChannels.join(", ") || "None"}
          {" · "}
          Success rate this month (IST):{" "}
          {organization.monthlyDeliverySuccessRatePercent == null
            ? "No decided deliveries"
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
            Client settings
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            Active/inactive, live Custom HTTP approval, and timezone. Not
            related to billing.
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
            Activate a plan
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            Razorpay payment links for STARTER/PRO/CUSTOM, or activate
            immediately without payment.
          </p>
        </div>
        <PlanActivationForm organization={organization} planLabels={planLabels} />
      </Panel>

      <Panel>
        <div className="border-b border-stone-200 px-5 py-3 sm:px-6">
          <h2 className="text-sm font-semibold text-stone-900">
            Deal history
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            Every STARTER/PRO/CUSTOM deal activated for this org, independent
            of access/expiry.
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
            Channel top-ups
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            CUSTOM plan only: add capacity to one channel for the current
            period without a new deal.
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
            Record a payment
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            Settles the outstanding balance only — never changes access or
            the expiry date.
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
            Payment links
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            History for all plans. Creating a new link auto-cancels any
            still-outstanding one for this org.
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
            Failed queue diagnostics
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            Safe operational details only. Ambiguous retries require duplicate
            risk confirmation.
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
            Recent Platform Admin activity
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            Security-relevant changes recorded for this client.
          </p>
        </div>
        {recentActivity.length === 0 ? (
          <p className="px-5 py-4 text-sm text-stone-500">
            No Platform Admin activity recorded yet.
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
                    {event.actorName ?? "Deleted Platform Admin"} ·{" "}
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
        <h2 className="text-sm font-semibold text-stone-900">Users</h2>
        <p className="mt-0.5 text-sm text-stone-600">
          Activate or deactivate client users (Owner / Staff), or add one
          directly.
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
        <h2 className="text-sm font-semibold text-stone-900">Contacts</h2>
        <p className="mt-0.5 text-sm text-stone-600">
          Add contacts to this client&rsquo;s account, or import a CSV/Excel
          file on their behalf.
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
        description={`${organization.slug} · Created ${formatDisplayDate(organization.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={organization.isActive ? "Active" : "Inactive"}
              tone={organization.isActive ? "success" : "neutral"}
            />
            <StatusBadge
              label={organization.health.label.replace("_", " ")}
              tone={
                organization.health.label === "HEALTHY"
                  ? "success"
                  : organization.health.label === "NEEDS_ATTENTION"
                    ? "warning"
                    : "neutral"
              }
            />
            <SecondaryButtonLink href="/admin/organizations">
              Back to list
            </SecondaryButtonLink>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Panel className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Contacts
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
            Messages this month
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
            Users
          </p>
          <p className="mt-1 text-xl font-semibold text-stone-900">
            {organization.userCount}
          </p>
        </Panel>
        <Panel className="px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Outstanding balance
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
            Settles via payments — never affects access
          </p>
        </Panel>
      </div>

      <Suspense
        fallback={
          <Panel className="p-5">
            <p className="text-sm text-stone-500">Loading…</p>
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
