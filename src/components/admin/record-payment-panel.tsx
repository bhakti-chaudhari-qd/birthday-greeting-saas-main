"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass } from "@/components/ui/page";
import { formatInrFromPaise } from "@/lib/billing/catalogue";
import type { PlanPaymentSummary } from "@/lib/billing/plan-ledger";
import { getAdminClientDetailDict } from "@/lib/i18n/dictionaries/admin-client-detail";
import { useLocale } from "@/lib/i18n/use-locale";
import { formatCustomerDateTime } from "@/lib/ui/datetime";

type RecordPaymentPanelProps = {
  organizationId: string;
  payments: PlanPaymentSummary[];
};

/** Settles the outstanding balance (FIFO across unpaid deals/top-ups). Never touches access/expiry. */
export function RecordPaymentPanel({
  organizationId,
  payments,
}: RecordPaymentPanelProps) {
  const router = useRouter();
  const dict = getAdminClientDetailDict(useLocale()).recordPayment;
  const [amountRupees, setAmountRupees] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleRecordPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const amountPaise = Math.round(Number.parseFloat(amountRupees) * 100);
      const response = await fetch(
        `/api/v1/admin/organizations/${organizationId}/payments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountPaise,
            ...(note.trim() ? { note: note.trim() } : {}),
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? dict.failedToRecord);
        return;
      }
      setSuccess(dict.recordedSuccess);
      setAmountRupees("");
      setNote("");
      router.refresh();
    } catch {
      setError(dict.failedToRecord);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 p-5 sm:p-6">
      <form className="space-y-3" onSubmit={handleRecordPayment}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-stone-800">{dict.amountInr}</span>
            <input
              className={`mt-1 ${inputClass}`}
              type="number"
              min={1}
              step="1"
              value={amountRupees}
              onChange={(event) => setAmountRupees(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">
              {dict.note} {dict.optional}
            </span>
            <input
              className={`mt-1 ${inputClass}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
            />
          </label>
        </div>
        <p className="text-xs text-stone-500">{dict.hint}</p>
        <button type="submit" disabled={busy} className={primaryButtonClass}>
          {busy ? dict.recording : dict.recordPayment}
        </button>

        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
        {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}
      </form>

      {payments.length > 0 ? (
        <div className="border-t border-stone-200 pt-4">
          <h4 className="text-sm font-semibold text-stone-900">
            {dict.history}
          </h4>
          <ul className="mt-2 divide-y divide-stone-100 text-sm">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="text-stone-700">
                  {formatInrFromPaise(payment.amountPaise)}
                  {payment.note ? ` — ${payment.note}` : ""}
                  {payment.recordedByAdminName
                    ? ` ${dict.by(payment.recordedByAdminName)}`
                    : ""}
                </span>
                <span className="text-xs text-stone-500">
                  {formatCustomerDateTime(payment.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
