"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass } from "@/components/ui/page";
import { PasswordField } from "@/components/ui/password-field";
import { STRONG_PASSWORD_MESSAGE } from "@/lib/auth/password-policy";

export function AddClientForm() {
  const router = useRouter();
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
        setError(payload.error?.message ?? "Failed to create client");
        return;
      }

      router.push(`/admin/organizations/${payload.data.organization.id}`);
      router.refresh();
    } catch {
      setError("Failed to create client");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Client name</span>
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
        <span className="font-medium text-stone-800">Owner name</span>
        <input
          name="adminName"
          className={`mt-1 ${inputClass}`}
          minLength={2}
          maxLength={100}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Owner email</span>
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
        <span className="font-medium text-stone-800">Owner mobile</span>
        <input
          name="mobile"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          className={`mt-1 ${inputClass}`}
          placeholder="10-digit mobile number"
          required
        />
      </label>
      <PasswordField
        label="Initial password"
        name="password"
        required
        autoComplete="new-password"
      />
      <p className="text-xs text-stone-500">
        {STRONG_PASSWORD_MESSAGE} Share it with the client securely; they can
        change it after signing in.
      </p>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      <button
        type="submit"
        disabled={submitting}
        className={primaryButtonClass}
      >
        {submitting ? "Creating…" : "Add client"}
      </button>
    </form>
  );
}
