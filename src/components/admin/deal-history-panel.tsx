import { StatusBadge } from "@/components/ui/feedback";
import {
  formatInrFromPaise,
  getPlanDisplayLabel,
  type PlanLabelMap,
} from "@/lib/billing/catalogue";
import type { PlanDealSummary } from "@/lib/billing/plan-ledger";
import { formatCustomerDateTime } from "@/lib/ui/datetime";

type DealHistoryPanelProps = {
  deals: PlanDealSummary[];
  planLabels: PlanLabelMap;
};

const DEAL_STATUS_TONE = {
  UNPAID: "danger",
  PARTIALLY_PAID: "warning",
  PAID: "success",
} as const;

export function DealHistoryPanel({ deals, planLabels }: DealHistoryPanelProps) {
  return (
    <div className="p-5 sm:p-6">
      {deals.length === 0 ? (
        <p className="text-sm text-stone-500">No plan deals activated yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                <th className="py-2 pr-4">Activated</th>
                <th className="py-2 pr-4">Plan</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Duration</th>
                <th className="py-2 pr-4">Limits</th>
                <th className="py-2 pr-4">Expiry after this deal</th>
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
                      `${(deal.monthlyMessageLimit ?? 0).toLocaleString("en-IN")} messages/mo`
                    )}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap text-stone-700">
                    {formatCustomerDateTime(deal.resultingPaidUntil)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
