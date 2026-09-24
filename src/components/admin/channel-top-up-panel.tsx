"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { InlineAlert, StatusBadge } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass } from "@/components/ui/page";
import { formatInrFromPaise } from "@/lib/billing/catalogue";
import type { CustomPlanTopUpSummary } from "@/lib/billing/plan-ledger";
import { getAdminClientDetailDict } from "@/lib/i18n/dictionaries/admin-client-detail";
import { useLocale } from "@/lib/i18n/use-locale";
import { formatCustomerDateTime } from "@/lib/ui/datetime";

type ChannelLimitInfo = {
  channel: "SMS" | "WHATSAPP" | "EMAIL";
  monthlyLimit: number;
  messagesSentThisMonth: number;
};

type ChannelTopUpPanelProps = {
  organizationId: string;
  topUps: CustomPlanTopUpSummary[];
  channelLimits: ChannelLimitInfo[];
};

const DEAL_STATUS_TONE = {
  UNPAID: "danger",
  PARTIALLY_PAID: "warning",
  PAID: "success",
} as const;

const TOP_UP_CHANNELS = ["SMS", "WHATSAPP", "EMAIL"] as const;

/** CUSTOM-plan only: increases one channel's limit for the current period without a new deal. */
export function ChannelTopUpPanel({
  organizationId,
  topUps,
  channelLimits,
}: ChannelTopUpPanelProps) {
  const router = useRouter();
  const dict = getAdminClientDetailDict(useLocale()).channelTopUp;
  const [topUpChannel, setTopUpChannel] =
    useState<(typeof TOP_UP_CHANNELS)[number]>("SMS");
  const [topUpMessages, setTopUpMessages] = useState("");
  const [topUpAmountRupees, setTopUpAmountRupees] = useState("");
  const [topUpBusy, setTopUpBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedChannelInfo = channelLimits.find(
    (entry) => entry.channel === topUpChannel,
  );

  async function handleTopUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTopUpBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const amountPaise = Math.round(
        Number.parseFloat(topUpAmountRupees || "0") * 100,
      );
      const response = await fetch(
        `/api/v1/admin/organizations/${organizationId}/channel-top-ups`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: topUpChannel,
            messagesAdded: Number.parseInt(topUpMessages, 10),
            amountPaise,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? dict.failedToAdd);
        return;
      }
      setSuccess(dict.addedSuccess(topUpMessages, topUpChannel));
      setTopUpMessages("");
      setTopUpAmountRupees("");
      router.refresh();
    } catch {
      setError(dict.failedToAdd);
    } finally {
      setTopUpBusy(false);
    }
  }

  return (
    <div className="space-y-6 p-5 sm:p-6">
      <form className="space-y-3" onSubmit={handleTopUp}>
        <p className="text-xs text-stone-500">{dict.hint}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="font-medium text-stone-800">{dict.channel}</span>
            <select
              className={`mt-1 ${inputClass}`}
              value={topUpChannel}
              onChange={(event) =>
                setTopUpChannel(
                  event.target.value as (typeof TOP_UP_CHANNELS)[number],
                )
              }
            >
              {TOP_UP_CHANNELS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">
              {dict.messagesToAdd}
            </span>
            <input
              className={`mt-1 ${inputClass}`}
              type="number"
              min={1}
              step="1"
              value={topUpMessages}
              onChange={(event) => setTopUpMessages(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">{dict.amountInr}</span>
            <input
              className={`mt-1 ${inputClass}`}
              type="number"
              min={0}
              step="1"
              value={topUpAmountRupees}
              onChange={(event) => setTopUpAmountRupees(event.target.value)}
              required
            />
          </label>
        </div>
        <p className="text-xs text-stone-500">
          {selectedChannelInfo
            ? dict.currentLimit(
                topUpChannel,
                selectedChannelInfo.messagesSentThisMonth.toLocaleString("en-IN"),
                selectedChannelInfo.monthlyLimit.toLocaleString("en-IN"),
              )
            : dict.currentLimitNoAllocation}
        </p>
        <button type="submit" disabled={topUpBusy} className={primaryButtonClass}>
          {topUpBusy ? dict.adding : dict.addCapacity}
        </button>

        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
        {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}
      </form>

      <div className="border-t border-stone-200 pt-4">
        <h4 className="text-sm font-semibold text-stone-900">
          {dict.history}
        </h4>
        {topUps.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">{dict.noTopUps}</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-stone-500">
                  <th className="py-2 pr-4">{dict.date}</th>
                  <th className="py-2 pr-4">{dict.channel}</th>
                  <th className="py-2 pr-4">{dict.messagesAdded}</th>
                  <th className="py-2 pr-4">{dict.amountInr}</th>
                  <th className="py-2 pr-4">{dict.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {topUps.map((topUp) => (
                  <tr key={topUp.id}>
                    <td className="py-2 pr-4 whitespace-nowrap text-stone-700">
                      {formatCustomerDateTime(topUp.createdAt)}
                    </td>
                    <td className="py-2 pr-4 text-stone-700">
                      {topUp.channel}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap text-stone-700">
                      +{topUp.messagesAdded.toLocaleString("en-IN")} (
                      {topUp.resultingMonthlyLimit.toLocaleString("en-IN")}{" "}
                      {dict.total})
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap text-stone-700">
                      {formatInrFromPaise(topUp.amountPaidPaise)} /{" "}
                      {formatInrFromPaise(topUp.amountDuePaise)}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge
                        label={topUp.paymentStatus.replace("_", " ")}
                        tone={DEAL_STATUS_TONE[topUp.paymentStatus]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
