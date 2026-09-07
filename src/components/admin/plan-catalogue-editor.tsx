"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass } from "@/components/ui/page";
import type { PlanCatalogueEntrySummary } from "@/lib/admin/plan-catalogue-ops";
import { formatCustomerDateTime } from "@/lib/ui/datetime";

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
            amountPaise: Math.round(Number.parseFloat(priceRupees) * 100),
            contactLimit: Number.parseInt(contactLimit, 10),
            monthlyMessageLimit: Number.parseInt(monthlyMessageLimit, 10),
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Failed to save changes");
        return;
      }
      setSuccess("Saved. New checkouts and signups will use these values.");
      router.refresh();
    } catch {
      setError("Failed to save changes");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-4 p-5 sm:p-6" onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-stone-900">
          {entry.plan}
        </h4>
        <p className="text-xs text-stone-500">
          Last updated{" "}
          {formatCustomerDateTime(entry.updatedAt)}
          {entry.updatedByAdminName ? ` by ${entry.updatedByAdminName}` : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Name</span>
          <input
            className={`mt-1 ${inputClass}`}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={60}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Price (INR)</span>
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
          <span className="font-medium text-stone-800">Description</span>
          <input
            className={`mt-1 ${inputClass}`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={300}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Contact limit</span>
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
            Monthly message limit
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
        {busy ? "Saving…" : "Save changes"}
      </button>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}
    </form>
  );
}
