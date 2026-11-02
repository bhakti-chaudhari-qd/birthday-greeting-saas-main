"use client";

import { useState } from "react";

import { DealEditForm } from "@/components/admin/deal-edit-form";
import { StatusBadge } from "@/components/ui/feedback";
import { compactSecondaryButtonClass } from "@/components/ui/page";
import {
  formatInrFromPaise,
  getPlanDisplayLabel,
  type PlanLabelMap,
} from "@/lib/billing/catalogue";
import type { PlanDealSummary } from "@/lib/billing/plan-ledger";
import { getAdminClientDetailDict } from "@/lib/i18n/dictionaries/admin-client-detail";
import { useLocale } from "@/lib/i18n/use-locale";
import { formatCustomerDateTime } from "@/lib/ui/datetime";

type DealHistoryPanelProps = {
  organizationId: string;
  /** The org's plan right now; only a latest deal on this plan can be edited. */
  currentPlan: string | null;
  deals: PlanDealSummary[];
  planLabels: PlanLabelMap;
};

const DEAL_STATUS_TONE = {
  UNPAID: "danger",
  PARTIALLY_PAID: "warning",
  PAID: "success",
} as const;

export function DealHistoryPanel({
  organizationId,
  currentPlan,
  deals,
  planLabels,
}: DealHistoryPanelProps) {
  const dict = getAdminClientDetailDict(useLocale()).dealHistory;
  const [editing, setEditing] = useState(false);
  // Deals are newest first; only the current one can be edited.
  const editableDeal =
    deals[0] && deals[0].plan === currentPlan ? deals[0] : null;

  return (
    <div className="p-5 sm:p-6">
      {deals.length === 0 ? (
        <p className="text-sm text-stone-500">{dict.noDeals}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                <th className="py-2 pr-4">{dict.activated}</th>
                <th className="py-2 pr-4">{dict.plan}</th>
                <th className="py-2 pr-4">{dict.source}</th>
                <th className="py-2 pr-4">{dict.amount}</th>
                <th className="py-2 pr-4">{dict.status}</th>
                <th className="py-2 pr-4">{dict.duration}</th>
                <th className="py-2 pr-4">{dict.limits}</th>
                <th className="py-2 pr-4">{dict.expiryAfterDeal}</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {deals.map((deal) => (
                <tr key={deal.id}>
                  <td className="py-2 pr-4 whitespace-nowrap text-stone-700">
                    {formatCustomerDateTime(deal.activatedAt)}
                  </td>
                  <td className="py-2 pr-4 text-stone-700">
                    {getPlanDisplayLabel(deal.plan, planLabels)}
                  </td>
                  <td className="py-2 pr-4">
                    <StatusBadge
                      label={deal.source}
                      tone={deal.source === "DIRECT" ? "info" : "neutral"}
                    />
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap text-stone-700">
                    {formatInrFromPaise(deal.amountPaidPaise)} /{" "}
                    {formatInrFromPaise(deal.amountDuePaise)}
                  </td>
                  <td className="py-2 pr-4">
                    <StatusBadge
                      label={deal.paymentStatus.replace("_", " ")}
                      tone={DEAL_STATUS_TONE[deal.paymentStatus]}
                    />
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap text-stone-700">
                    {deal.durationDays}d
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap text-stone-700">
                    {deal.plan === "CUSTOM" ? (
                      <>
                        SMS {(deal.smsMonthlyLimit ?? 0).toLocaleString("en-IN")}{" "}
                        · WA{" "}
                        {(deal.whatsappMonthlyLimit ?? 0).toLocaleString(
                          "en-IN",
                        )}{" "}
                        · Email{" "}
                        {(deal.emailMonthlyLimit ?? 0).toLocaleString("en-IN")}
                      </>
                    ) : (
                      `${(deal.monthlyMessageLimit ?? 0).toLocaleString("en-IN")} ${dict.messagesPerMonth}`
                    )}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap text-stone-700">
                    {formatCustomerDateTime(deal.resultingPaidUntil)}
                  </td>
                  <td className="py-2 pr-4">
                    {deal.id === editableDeal?.id && !editing ? (
                      <button
                        type="button"
                        className={compactSecondaryButtonClass}
                        onClick={() => setEditing(true)}
                      >
                        {dict.edit}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && editableDeal ? (
        <DealEditForm
          organizationId={organizationId}
          deal={editableDeal}
          planLabels={planLabels}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}
