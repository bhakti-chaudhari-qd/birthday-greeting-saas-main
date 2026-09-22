"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass } from "@/components/ui/page";
import { getAdminVendorNewDict } from "@/lib/i18n/dictionaries/admin-vendor-new";
import { useLocale } from "@/lib/i18n/use-locale";

export function CreateVendorForm() {
  const router = useRouter();
  const dict = getAdminVendorNewDict(useLocale());
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/admin/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mobile }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const vendorId = payload.error?.details?.vendorId;
        if (typeof vendorId === "string") {
          // The vendor was created; only its invitation SMS failed or its
          // delivery is uncertain. Carry that into the vendor page as a
          // visible banner instead of navigating there looking like a
          // plain success.
          const inviteIssue = payload.error?.details?.deliveryUncertain
            ? dict.inviteIssueUncertain
            : dict.inviteIssueNotSent;
          router.push(
            `/admin/vendors/${vendorId}?inviteIssue=${encodeURIComponent(inviteIssue)}`,
          );
          router.refresh();
          return;
        }
        setError(payload.error?.message ?? dict.failedToCreateVendor);
        return;
      }

      router.push(`/admin/vendors/${payload.data.vendor.id}`);
      router.refresh();
    } catch {
      setError(dict.failedToCreateVendor);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">{dict.vendorName}</span>
        <input
          name="name"
          className={`mt-1 ${inputClass}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={100}
          required
          autoFocus
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">{dict.mobile}</span>
        <input
          name="mobile"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className={`mt-1 ${inputClass}`}
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          placeholder={dict.mobilePlaceholder}
          required
        />
        <span className="mt-1 block text-xs text-stone-500">
          {dict.mobileHint}
        </span>
      </label>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      <button
        type="submit"
        disabled={submitting}
        className={primaryButtonClass}
      >
        {submitting ? dict.creatingAndSending : dict.createVendorAndSendSms}
      </button>
    </form>
  );
}
