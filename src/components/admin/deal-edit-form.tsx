"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, secondaryButtonClass } from "@/components/ui/page";
import {
  formatInrFromPaise,
  getPlanDisplayLabel,
  type PlanLabelMap,
} from "@/lib/billing/catalogue";
import type { PlanDealSummary } from "@/lib/billing/plan-ledger";
import { getAdminClientDetailDict } from "@/lib/i18n/dictionaries/admin-client-detail";
import { useLocale } from "@/lib/i18n/use-locale";
import { formatCustomerDateTime } from "@/lib/ui/datetime";

const DAY_MS = 24 * 60 * 60 * 1000;

type DealEditFormProps = {
  organizationId: string;
  deal: PlanDealSummary;
  planLabels: PlanLabelMap;
  onClose: () => void;
};

/** Edits the current plan deal; saving applies it now, with or without charging the balance. */
export function DealEditForm({
  organizationId,
  deal,
  planLabels,
  onClose,
}: DealEditFormProps) {
  const router = useRouter();
  const dict = getAdminClientDetailDict(useLocale()).dealHistory;
  const isCustom = deal.plan === "CUSTOM";

  const [durationDays, setDurationDays] = useState(String(deal.durationDays));
  const [amountRupees, setAmountRupees] = useState(
    String(deal.amountDuePaise / 100),
  );
  const [contactLimit, setContactLimit] = useState(String(deal.contactLimit));
  const [monthlyMessageLimit, setMonthlyMessageLimit] = useState(
    String(deal.monthlyMessageLimit ?? 0),
  );
  const [smsMonthlyLimit, setSmsMonthlyLimit] = useState(
    String(deal.smsMonthlyLimit ?? 0),
  );
  const [whatsappMonthlyLimit, setWhatsappMonthlyLimit] = useState(
    String(deal.whatsappMonthlyLimit ?? 0),
  );
  const [emailMonthlyLimit, setEmailMonthlyLimit] = useState(
    String(deal.emailMonthlyLimit ?? 0),
  );
  const [customerEmail, setCustomerEmail] = useState("");
  const [busy, setBusy] = useState<"charge" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);

  const durationNum = Number.parseInt(durationDays, 10) || 0;
  const amountPaise = Math.round((Number.parseFloat(amountRupees) || 0) * 100);
  const balancePaise = Math.max(0, amountPaise - deal.amountPaidPaise);
  const newExpiry = new Date(
    new Date(deal.resultingPaidUntil).getTime() +
      (durationNum - deal.durationDays) * DAY_MS,
  );

  async function save(charge: boolean) {
    setBusy(charge ? "charge" : "save");
    setError(null);
    setSuccess(null);
    setPaymentLinkUrl(null);

    try {
      const body: Record<string, unknown> = {
        durationDays: durationNum,
        amountPaise,
        contactLimit: Number.parseInt(contactLimit, 10),
        charge,
      };
      if (isCustom) {
        body.smsMonthlyLimit = Number.parseInt(smsMonthlyLimit, 10);
        body.whatsappMonthlyLimit = Number.parseInt(whatsappMonthlyLimit, 10);
        body.emailMonthlyLimit = Number.parseInt(emailMonthlyLimit, 10);
      } else {
        body.monthlyMessageLimit = Number.parseInt(monthlyMessageLimit, 10);
      }
      if (charge && customerEmail.trim()) {
        body.customerEmail = customerEmail.trim();
      }

      const response = await fetch(
        `/api/v1/admin/organizations/${organizationId}/plan-deals/${deal.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? dict.failedToSave);
        return;
      }

      if (payload.data.paymentLinkError) {
        setError(dict.linkFailed(payload.data.paymentLinkError));
      } else if (payload.data.paymentLink) {
        setPaymentLinkUrl(payload.data.paymentLink.shortUrl);
        setSuccess(
          dict.chargedSuccess(
            formatInrFromPaise(payload.data.paymentLink.amountPaise),
          ),
        );
      } else {
        setSuccess(dict.savedSuccess);
      }
      router.refresh();
    } catch {
      setError(dict.failedToSave);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 space-y-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
      <div>
        <h3 className="text-sm font-semibold text-stone-900">
          {dict.editTitle(getPlanDisplayLabel(deal.plan, planLabels))}
        </h3>
        <p className="mt-0.5 text-sm text-stone-600">{dict.editHint}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="font-medium text-stone-800">{dict.durationDays}</span>
          <input
            className={`mt-1 ${inputClass}`}
            type="number"
            min={1}
            max={366}
            value={durationDays}
            onChange={(event) => setDurationDays(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">{dict.amountInr}</span>
          <input
            className={`mt-1 ${inputClass}`}
            type="number"
            min={0}
            step="1"
            value={amountRupees}
            onChange={(event) => setAmountRupees(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">{dict.contactLimit}</span>
          <input
            className={`mt-1 ${inputClass}`}
            type="number"
            min={1}
            value={contactLimit}
            onChange={(event) => setContactLimit(event.target.value)}
          />
        </label>
      </div>

      {isCustom ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="font-medium text-stone-800">{dict.smsPerMonth}</span>
            <input
              className={`mt-1 ${inputClass}`}
              type="number"
              min={0}
              value={smsMonthlyLimit}
              onChange={(event) => setSmsMonthlyLimit(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">
              {dict.whatsappPerMonth}
            </span>
            <input
              className={`mt-1 ${inputClass}`}
              type="number"
              min={0}
              value={whatsappMonthlyLimit}
              onChange={(event) => setWhatsappMonthlyLimit(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">{dict.emailPerMonth}</span>
            <input
              className={`mt-1 ${inputClass}`}
              type="number"
              min={0}
              value={emailMonthlyLimit}
              onChange={(event) => setEmailMonthlyLimit(event.target.value)}
            />
          </label>
        </div>
      ) : (
        <label className="block text-sm sm:max-w-xs">
          <span className="font-medium text-stone-800">{dict.monthlyMessages}</span>
          <input
            className={`mt-1 ${inputClass}`}
            type="number"
            min={0}
            value={monthlyMessageLimit}
            onChange={(event) => setMonthlyMessageLimit(event.target.value)}
          />
        </label>
      )}

      <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700">
        <p>
          {dict.newExpiry}: <strong>{formatCustomerDateTime(newExpiry)}</strong>
        </p>
        <p className="mt-1">
          {dict.balanceAfterEdit(
            formatInrFromPaise(deal.amountPaidPaise),
            formatInrFromPaise(balancePaise),
          )}
        </p>
      </div>

      <label className="block text-sm sm:max-w-sm">
        <span className="font-medium text-stone-800">{dict.customerEmail}</span>
        <input
          className={`mt-1 ${inputClass}`}
          type="email"
          value={customerEmail}
          onChange={(event) => setCustomerEmail(event.target.value)}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy !== null || balancePaise < 100}
          className={secondaryButtonClass}
          onClick={() => void save(true)}
        >
          {busy === "charge"
            ? dict.saving
            : dict.saveAndCharge(formatInrFromPaise(balancePaise))}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          className={secondaryButtonClass}
          onClick={() => void save(false)}
        >
          {busy === "save" ? dict.saving : dict.saveWithoutPayment}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          className="text-sm text-stone-600 underline"
          onClick={onClose}
        >
          {dict.close}
        </button>
      </div>
      {balancePaise < 100 ? (
        <p className="text-xs text-stone-500">{dict.nothingToCharge}</p>
      ) : null}

      {paymentLinkUrl ? (
        <p className="break-all text-sm text-sky-900">
          {dict.link}:{" "}
          <a
            href={paymentLinkUrl}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {paymentLinkUrl}
          </a>
        </p>
      ) : null}

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}
    </div>
  );
}
