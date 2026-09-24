"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass } from "@/components/ui/page";
import type { PlatformOrganizationDetail } from "@/lib/admin/org-ops";
import { getAdminClientDetailDict } from "@/lib/i18n/dictionaries/admin-client-detail";
import { useLocale } from "@/lib/i18n/use-locale";

type OrganizationOpsFormProps = {
  organization: PlatformOrganizationDetail;
};

/** Basic account-level flags: active/inactive, live-channel approval, timezone. Not billing. */
export function OrganizationOpsForm({ organization }: OrganizationOpsFormProps) {
  const router = useRouter();
  const dict = getAdminClientDetailDict(useLocale()).opsForm;
  const [isActive, setIsActive] = useState(organization.isActive);
  const [liveChannelsApproved, setLiveChannelsApproved] = useState(
    organization.liveChannelsApproved,
  );
  const [staffContactVisibilityAdminAllowed, setStaffContactVisibilityAdminAllowed] =
    useState(organization.staffContactVisibilityAdminAllowed);
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
            staffContactVisibilityAdminAllowed,
            timezone,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? dict.failedToSaveClient);
        return;
      }
      setSuccess(dict.clientUpdated);
      router.refresh();
    } catch {
      setError(dict.failedToSaveClient);
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
        <span className="font-medium">{dict.clientActive}</span>
      </label>

      <label className="flex items-center gap-2 text-sm text-stone-800">
        <input
          type="checkbox"
          checked={liveChannelsApproved}
          onChange={(event) => setLiveChannelsApproved(event.target.checked)}
        />
        <span className="font-medium">{dict.approveLiveCustomHttp}</span>
      </label>

      <label className="flex items-start gap-2 text-sm text-stone-800">
        <input
          type="checkbox"
          className="mt-1"
          checked={staffContactVisibilityAdminAllowed}
          onChange={(event) =>
            setStaffContactVisibilityAdminAllowed(event.target.checked)
          }
        />
        <span>
          <span className="font-medium">{dict.allowStaffVisibility}</span>
          <span className="mt-0.5 block text-xs text-stone-500">
            {dict.allowStaffVisibilityHint}
          </span>
        </span>
      </label>

      <label className="block text-sm">
        <span className="font-medium text-stone-800">{dict.timezone}</span>
        <input
          className={`mt-1 ${inputClass}`}
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          required
        />
      </label>

      <button type="submit" disabled={saving} className={primaryButtonClass}>
        {saving ? dict.saving : dict.saveOpsSettings}
      </button>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}

      <ConfirmDialog
        open={pendingDeactivateConfirm}
        title={dict.deactivateTitle}
        message={dict.deactivateMessage(organization.name)}
        confirmLabel={dict.deactivate}
        cancelLabel={dict.cancel}
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
