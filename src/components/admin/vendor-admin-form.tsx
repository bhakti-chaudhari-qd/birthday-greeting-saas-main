"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { InlineAlert } from "@/components/ui/feedback";
import { isActiveAmbiguousVendorInvite } from "@/components/admin/vendor-lifecycle";
import {
  compactSecondaryButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/page";
import type { PlatformVendorDetail } from "@/lib/admin/vendors";

type VendorAdminFormProps = {
  vendor: PlatformVendorDetail;
};

export function VendorAdminForm({ vendor }: VendorAdminFormProps) {
  const router = useRouter();
  const [name, setName] = useState(vendor.name);
  const [referralCode, setReferralCode] = useState(vendor.referralCode);
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const hasActiveAmbiguousInvite = isActiveAmbiguousVendorInvite(
    vendor.latestInvite,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/v1/admin/vendors/${vendor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          referralCode,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Failed to save vendor");
        return;
      }

      const updated = payload.data?.vendor as PlatformVendorDetail | undefined;
      if (updated) {
        setName(updated.name);
        setReferralCode(updated.referralCode);
      }
      setSuccess("Vendor saved");
      router.refresh();
    } catch {
      setError("Failed to save vendor");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(
    label: string,
    confirmation: string,
    path: string,
    body?: Record<string, unknown>,
  ) {
    if (!window.confirm(confirmation)) return;
    setAction(label);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(path, {
        method: body ? "PATCH" : "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? `Failed to ${label.toLowerCase()}`);
        return;
      }
      setSuccess(`${label} completed`);
      router.refresh();
    } catch {
      setError(`Failed to ${label.toLowerCase()}`);
    } finally {
      setAction(null);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Name</span>
        <input
          className={`mt-1 ${inputClass}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium text-stone-800">Referral code</span>
        <input
          className={`mt-1 font-mono uppercase ${inputClass}`}
          value={referralCode}
          onChange={(event) => setReferralCode(event.target.value)}
          required
        />
        <span className="mt-1 block text-xs text-stone-500">
          One code per vendor. Letters, numbers, and hyphens (2-32 characters).
        </span>
      </label>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving || action !== null}
          className={primaryButtonClass}
        >
          {saving ? "Saving…" : "Save vendor"}
        </button>
        {vendor.userCount === 0 &&
        (vendor.onboardingStatus === "DRAFT" ||
          vendor.onboardingStatus === "INVITED") ? (
          <button
            type="button"
            disabled={action !== null}
            className={secondaryButtonClass}
            onClick={() =>
              runAction(
                vendor.onboardingStatus === "DRAFT"
                  ? "Retry SMS"
                  : "Reissue SMS",
                hasActiveAmbiguousInvite
                  ? "SMS delivery is uncertain and the current invitation remains valid. Verify with the vendor before reissuing; continuing will revoke the current invitation."
                  : "Send a new registration SMS? Any previous invitation will be revoked.",
                `/api/v1/admin/vendors/${vendor.id}/registration-link`,
              )
            }
          >
            {action ??
              (vendor.onboardingStatus === "DRAFT"
                ? "Retry invitation SMS"
                : hasActiveAmbiguousInvite
                  ? "Reissue SMS (delivery uncertain)"
                  : "Reissue invitation SMS")}
          </button>
        ) : null}
        {vendor.onboardingStatus === "PENDING" ? (
          <>
            <button
              type="button"
              disabled={action !== null}
              className={secondaryButtonClass}
              onClick={() =>
                runAction(
                  "Approve",
                  "Approve this vendor registration?",
                  `/api/v1/admin/vendors/${vendor.id}/approve`,
                )
              }
            >
              Approve
            </button>
            <button
              type="button"
              disabled={action !== null}
              className={compactSecondaryButtonClass}
              onClick={() =>
                runAction(
                  "Reject",
                  "Reject this vendor registration?",
                  `/api/v1/admin/vendors/${vendor.id}/reject`,
                )
              }
            >
              Reject
            </button>
          </>
        ) : null}
        {vendor.onboardingStatus === "APPROVED" ? (
          <button
            type="button"
            disabled={action !== null}
            className={secondaryButtonClass}
            onClick={() =>
              runAction(
                vendor.isActive ? "Suspend" : "Reactivate",
                vendor.isActive
                  ? "Suspend this active vendor?"
                  : "Reactivate this approved vendor?",
                `/api/v1/admin/vendors/${vendor.id}`,
                { isActive: !vendor.isActive },
              )
            }
          >
            {vendor.isActive ? "Suspend vendor" : "Reactivate vendor"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
