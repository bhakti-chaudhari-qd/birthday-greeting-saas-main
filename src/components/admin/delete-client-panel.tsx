"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { InlineAlert } from "@/components/ui/feedback";
import { inputClass } from "@/components/ui/page";
import { getAdminClientDetailDict } from "@/lib/i18n/dictionaries/admin-client-detail";
import { useLocale } from "@/lib/i18n/use-locale";

type DeleteClientPanelProps = {
  organizationId: string;
  organizationName: string;
};

/** Permanent client removal, gated on typing the client's name. */
export function DeleteClientPanel({
  organizationId,
  organizationName,
}: DeleteClientPanelProps) {
  const router = useRouter();
  const dict = getAdminClientDetailDict(useLocale()).opsForm;
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameMatches = confirmName.trim() === organizationName.trim();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nameMatches) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/admin/organizations/${organizationId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmName: confirmName.trim() }),
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? dict.failedToDeleteClient);
        setDeleting(false);
        return;
      }
      router.push("/admin/organizations");
      router.refresh();
    } catch {
      setError(dict.failedToDeleteClient);
      setDeleting(false);
    }
  }

  return (
    <form className="space-y-4 p-5 sm:p-6" onSubmit={handleSubmit}>
      <p className="text-sm text-stone-600">{dict.deleteDescription}</p>

      <label className="block text-sm">
        <span className="font-medium text-stone-800">
          {dict.deleteConfirmLabel(organizationName)}
        </span>
        <input
          className={`mt-1 ${inputClass}`}
          value={confirmName}
          autoComplete="off"
          onChange={(event) => setConfirmName(event.target.value)}
        />
      </label>

      <button
        type="submit"
        disabled={!nameMatches || deleting}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white outline-none hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {deleting ? dict.deleting : dict.deleteButton}
      </button>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
    </form>
  );
}
