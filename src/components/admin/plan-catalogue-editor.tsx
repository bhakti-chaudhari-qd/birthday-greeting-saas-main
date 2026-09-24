"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass } from "@/components/ui/page";
import type { PlanCatalogueEntrySummary } from "@/lib/admin/plan-catalogue-ops";
import { getAdminPlanCatalogueDict } from "@/lib/i18n/dictionaries/admin-plan-catalogue";
import { useLocale } from "@/lib/i18n/use-locale";
import { formatCustomerDateTime } from "@/lib/ui/datetime";

function formatRupees(amountPaise: number): string {
  return `₹${(amountPaise / 100).toLocaleString("en-IN")}`;
}

type PlanCatalogueEditorProps = {
  entries: PlanCatalogueEntrySummary[];
};

export function PlanCatalogueEditor({ entries }: PlanCatalogueEditorProps) {
  return (
    <div className="divide-y divide-stone-200">
      {entries.map((entry) => (
        <PlanCatalogueEntryForm key={entry.plan} entry={entry} />
      ))}
    </div>
  );
}

function PlanCatalogueEntryForm({
  entry,
}: {
  entry: PlanCatalogueEntrySummary;
}) {
  const router = useRouter();
  const dict = getAdminPlanCatalogueDict(useLocale());
  const [label, setLabel] = useState(entry.label);
  const [description, setDescription] = useState(entry.description);
  const [priceRupees, setPriceRupees] = useState(
    String(entry.amountPaise / 100),
  );
  const [contactLimit, setContactLimit] = useState(
    String(entry.contactLimit),
  );
  const [monthlyMessageLimit, setMonthlyMessageLimit] = useState(
    String(entry.monthlyMessageLimit),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const parsedAmountPaise = Math.round(Number.parseFloat(priceRupees) * 100);
  const parsedContactLimit = Number.parseInt(contactLimit, 10);
  const parsedMonthlyMessageLimit = Number.parseInt(monthlyMessageLimit, 10);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (
      !Number.isFinite(parsedAmountPaise) ||
      !Number.isFinite(parsedContactLimit) ||
      !Number.isFinite(parsedMonthlyMessageLimit)
    ) {
      setError(dict.invalidNumbers);
      return;
    }

    setConfirming(true);
  }

  async function confirmSave() {
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/v1/admin/plan-catalogue/${entry.plan}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label,
            description,
            amountPaise: parsedAmountPaise,
            contactLimit: parsedContactLimit,
            monthlyMessageLimit: parsedMonthlyMessageLimit,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? dict.failedToSave);
        return;
      }
      setSuccess(dict.savedSuccess);
      router.refresh();
    } catch {
      setError(dict.failedToSave);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <form className="space-y-4 p-5 sm:p-6" onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-stone-900">
          {entry.plan}
        </h4>
        <p className="text-xs text-stone-500">
          {dict.lastUpdated}{" "}
          {formatCustomerDateTime(entry.updatedAt)}
          {entry.updatedByAdminName
            ? ` ${dict.by(entry.updatedByAdminName)}`
            : ""}
        </p>
      </div>

      {entry.razorpayPricePinned ? (
        <InlineAlert tone="warning">
          {dict.razorpayPinnedWarning(entry.plan)}
        </InlineAlert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-stone-800">{dict.name}</span>
          <input
            className={`mt-1 ${inputClass}`}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={60}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">{dict.priceInr}</span>
          <input
            className={`mt-1 ${inputClass}`}
            type="number"
            min={1}
            step="1"
            value={priceRupees}
            onChange={(event) => setPriceRupees(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-stone-800">{dict.description2}</span>
          <input
            className={`mt-1 ${inputClass}`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={300}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">{dict.contactLimit}</span>
          <input
            className={`mt-1 ${inputClass}`}
            type="number"
            min={1}
            step="1"
            value={contactLimit}
            onChange={(event) => setContactLimit(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">
            {dict.monthlyMessageLimit}
          </span>
          <input
            className={`mt-1 ${inputClass}`}
            type="number"
            min={1}
            step="1"
            value={monthlyMessageLimit}
            onChange={(event) => setMonthlyMessageLimit(event.target.value)}
            required
          />
        </label>
      </div>

      <button type="submit" disabled={busy} className={primaryButtonClass}>
        {busy ? dict.saving : dict.saveChanges}
      </button>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}

      <ConfirmDialog
        open={confirming}
        title={dict.confirmTitle(entry.plan)}
        message={
          <>
            <p>{dict.confirmIntro(entry.plan)}</p>
            <dl className="mt-3 space-y-1">
              <div className="flex justify-between gap-4">
                <dt className="text-stone-500">{dict.price}</dt>
                <dd className="font-medium text-stone-900">
                  {formatRupees(entry.amountPaise)} → {formatRupees(parsedAmountPaise)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-stone-500">{dict.contactLimit}</dt>
                <dd className="font-medium text-stone-900">
                  {entry.contactLimit} → {parsedContactLimit}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-stone-500">{dict.monthlyMessageLimit}</dt>
                <dd className="font-medium text-stone-900">
                  {entry.monthlyMessageLimit} → {parsedMonthlyMessageLimit}
                </dd>
              </div>
            </dl>
            {entry.razorpayPricePinned ? (
              <p className="mt-3 font-medium text-amber-800">
                {dict.confirmRazorpayPinnedNote}
              </p>
            ) : null}
          </>
        }
        confirmLabel={dict.saveChanges}
        busy={busy}
        onConfirm={() => void confirmSave()}
        onCancel={() => setConfirming(false)}
      />
    </form>
  );
}
