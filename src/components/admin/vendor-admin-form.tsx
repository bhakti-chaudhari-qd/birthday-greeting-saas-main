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
import { getAdminVendorDetailDict } from "@/lib/i18n/dictionaries/admin-vendor-detail";
import { useLocale } from "@/lib/i18n/use-locale";

type VendorAdminFormProps = {
  vendor: PlatformVendorDetail;
};

export function VendorAdminForm({ vendor }: VendorAdminFormProps) {
  const router = useRouter();
  const dict = getAdminVendorDetailDict(useLocale()).form;
  const [name, setName] = useState(vendor.name);
  const [referralCode, setReferralCode] = useState(vendor.referralCode);
  const [saving, setSaving] = useState(false);
  const [actionLabel, setActionLabel] = useState<string | null>(null);
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
        setError(payload.error?.message ?? dict.failedToSaveVendor);
        return;
      }

      const updated = payload.data?.vendor as PlatformVendorDetail | undefined;
      if (updated) {
        setName(updated.name);
        setReferralCode(updated.referralCode);
      }
      setSuccess(dict.vendorSaved);
      router.refresh();
    } catch {
      setError(dict.failedToSaveVendor);
    } finally {
      setSaving(false);
    }
  }

  /**
   * buttonLabel is shown on the button while the request is in flight (and
   * doubles as the loading state key); successMessage/failureMessage are
   * fully translated, standalone strings - not derived from buttonLabel, so
   * there's no locale-dependent casing/lowering involved.
   */
  async function runAction(config: {
    buttonLabel: string;
    confirmation: string;
    successMessage: string;
    failureMessage: string;
    path: string;
    body?: Record<string, unknown>;
  }) {
    if (!window.confirm(config.confirmation)) return;
    setActionLabel(config.buttonLabel);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(config.path, {
        method: config.body ? "PATCH" : "POST",
        headers: config.body ? { "Content-Type": "application/json" } : undefined,
        body: config.body ? JSON.stringify(config.body) : undefined,
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? config.failureMessage);
        return;
      }
      setSuccess(config.successMessage);
      router.refresh();
    } catch {
      setError(config.failureMessage);
    } finally {
      setActionLabel(null);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">{dict.name}</span>
        <input
          className={`mt-1 ${inputClass}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium text-stone-800">{dict.referralCode}</span>
        <input
          className={`mt-1 font-mono uppercase ${inputClass}`}
          value={referralCode}
          onChange={(event) => setReferralCode(event.target.value)}
          required
        />
        <span className="mt-1 block text-xs text-stone-500">
          {dict.referralCodeHint}
        </span>
      </label>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving || actionLabel !== null}
          className={primaryButtonClass}
        >
          {saving ? dict.saving : dict.saveVendor}
        </button>
        {vendor.userCount === 0 &&
        (vendor.onboardingStatus === "DRAFT" ||
          vendor.onboardingStatus === "INVITED") ? (
          <button
            type="button"
            disabled={actionLabel !== null}
            className={secondaryButtonClass}
            onClick={() => {
              const isDraft = vendor.onboardingStatus === "DRAFT";
              const buttonLabel = isDraft
                ? dict.retryInvitationSms
                : hasActiveAmbiguousInvite
                  ? dict.reissueSmsUncertain
                  : dict.reissueInvitationSms;
              void runAction({
                buttonLabel,
                confirmation: hasActiveAmbiguousInvite
                  ? dict.confirmUncertainReissue
                  : dict.confirmSendNewSms,
                successMessage: isDraft ? dict.smsRetryCompleted : dict.smsReissueCompleted,
                failureMessage: dict.failedToSendSms,
                path: `/api/v1/admin/vendors/${vendor.id}/registration-link`,
              });
            }}
          >
            {actionLabel ??
              (vendor.onboardingStatus === "DRAFT"
                ? dict.retryInvitationSms
                : hasActiveAmbiguousInvite
                  ? dict.reissueSmsUncertain
                  : dict.reissueInvitationSms)}
          </button>
        ) : null}
        {vendor.onboardingStatus === "PENDING" ? (
          <>
            <button
              type="button"
              disabled={actionLabel !== null}
              className={secondaryButtonClass}
              onClick={() =>
                void runAction({
                  buttonLabel: dict.approve,
                  confirmation: dict.confirmApprove,
                  successMessage: dict.approveCompleted,
                  failureMessage: dict.failedToApprove,
                  path: `/api/v1/admin/vendors/${vendor.id}/approve`,
                })
              }
            >
              {dict.approve}
            </button>
            <button
              type="button"
              disabled={actionLabel !== null}
              className={compactSecondaryButtonClass}
              onClick={() =>
                void runAction({
                  buttonLabel: dict.reject,
                  confirmation: dict.confirmReject,
                  successMessage: dict.rejectCompleted,
                  failureMessage: dict.failedToReject,
                  path: `/api/v1/admin/vendors/${vendor.id}/reject`,
                })
              }
            >
              {dict.reject}
            </button>
          </>
        ) : null}
        {vendor.onboardingStatus === "APPROVED" ? (
          <button
            type="button"
            disabled={actionLabel !== null}
            className={secondaryButtonClass}
            onClick={() =>
              void runAction({
                buttonLabel: vendor.isActive ? dict.suspendVendor : dict.reactivateVendor,
                confirmation: vendor.isActive ? dict.confirmSuspend : dict.confirmReactivate,
                successMessage: vendor.isActive
                  ? dict.suspendCompleted
                  : dict.reactivateCompleted,
                failureMessage: vendor.isActive
                  ? dict.failedToSuspend
                  : dict.failedToReactivate,
                path: `/api/v1/admin/vendors/${vendor.id}`,
                body: { isActive: !vendor.isActive },
              })
            }
          >
            {vendor.isActive ? dict.suspendVendor : dict.reactivateVendor}
          </button>
        ) : null}
      </div>
    </form>
  );
}
