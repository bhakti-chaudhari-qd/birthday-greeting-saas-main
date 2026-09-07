"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass } from "@/components/ui/page";
import type { PlatformOrganizationDetail } from "@/lib/admin/org-ops";

type OrganizationOpsFormProps = {
  organization: PlatformOrganizationDetail;
};

/** Basic account-level flags: active/inactive, live-channel approval, timezone. Not billing. */
export function OrganizationOpsForm({ organization }: OrganizationOpsFormProps) {
  const router = useRouter();
  const [isActive, setIsActive] = useState(organization.isActive);
  const [liveChannelsApproved, setLiveChannelsApproved] = useState(
    organization.liveChannelsApproved,
  );
  const [timezone, setTimezone] = useState(organization.timezone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingDeactivateConfirm, setPendingDeactivateConfirm] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (organization.isActive && !isActive) {
      setPendingDeactivateConfirm(true);
      return;
    }
    void performSave();
  }

  async function performSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/v1/admin/organizations/${organization.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isActive,
            liveChannelsApproved,
            timezone,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Failed to save organization");
        return;
      }
      setSuccess("Organization updated.");
      router.refresh();
    } catch {
      setError("Failed to save organization");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4 p-5 sm:p-6" onSubmit={handleSubmit}>
      <label className="flex items-center gap-2 text-sm text-stone-800">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
        <span className="font-medium">Organization active</span>
      </label>

      <label className="flex items-center gap-2 text-sm text-stone-800">
        <input
          type="checkbox"
          checked={liveChannelsApproved}
          onChange={(event) => setLiveChannelsApproved(event.target.checked)}
        />
        <span className="font-medium">
          Approve live Custom HTTP (even on FREE)
        </span>
      </label>

      <label className="block text-sm">
        <span className="font-medium text-stone-800">Timezone</span>
        <input
          className={`mt-1 ${inputClass}`}
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          required
        />
      </label>

      <button type="submit" disabled={saving} className={primaryButtonClass}>
        {saving ? "Saving…" : "Save ops settings"}
      </button>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}

      <ConfirmDialog
        open={pendingDeactivateConfirm}
        title="Deactivate organization?"
        message={
          <>
            <strong>{organization.name}</strong> and everyone in it will
            immediately lose access. This can be undone later by re-activating
            the organization.
          </>
        }
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        busy={saving}
        onConfirm={() => {
          setPendingDeactivateConfirm(false);
          void performSave();
        }}
        onCancel={() => setPendingDeactivateConfirm(false)}
      />
    </form>
  );
}
