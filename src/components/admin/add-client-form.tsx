"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass } from "@/components/ui/page";
import { PasswordField } from "@/components/ui/password-field";
import { getAdminClientNewDict } from "@/lib/i18n/dictionaries/admin-client-new";
import { useLocale } from "@/lib/i18n/use-locale";

export function AddClientForm() {
  const router = useRouter();
  const dict = getAdminClientNewDict(useLocale());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/v1/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: formData.get("organizationName"),
          adminName: formData.get("adminName"),
          email: formData.get("email"),
          mobile: formData.get("mobile"),
          password: formData.get("password"),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error?.message ?? dict.failedToCreateClient);
        return;
      }

      router.push(`/admin/organizations/${payload.data.organization.id}`);
      router.refresh();
    } catch {
      setError(dict.failedToCreateClient);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">{dict.clientName}</span>
        <input
          name="organizationName"
          className={`mt-1 ${inputClass}`}
          minLength={2}
          maxLength={100}
          required
          autoFocus
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">{dict.ownerName}</span>
        <input
          name="adminName"
          className={`mt-1 ${inputClass}`}
          minLength={2}
          maxLength={100}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">{dict.ownerEmail}</span>
        <input
          name="email"
          type="email"
          autoComplete="off"
          className={`mt-1 ${inputClass}`}
          maxLength={255}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">{dict.ownerMobile}</span>
        <input
          name="mobile"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          className={`mt-1 ${inputClass}`}
          placeholder={dict.mobilePlaceholder}
          required
        />
      </label>
      <PasswordField
        label={dict.initialPassword}
        name="password"
        required
        autoComplete="new-password"
      />
      <p className="text-xs text-stone-500">
        {dict.passwordHint} {dict.passwordShareNote}
      </p>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      <button
        type="submit"
        disabled={submitting}
        className={primaryButtonClass}
      >
        {submitting ? dict.creating : dict.addClient}
      </button>
    </form>
  );
}
