"use client";

import { useState } from "react";

import { inputClass, primaryButtonClass } from "@/components/ui/page";
import { PasswordField } from "@/components/ui/password-field";

type VendorRegistrationFormProps = {
  vendorName: string;
  maskedMobile: string;
};

export function VendorRegistrationSubmitted({
  vendorName,
}: {
  vendorName: string;
}) {
  return (
    <div
      className="rounded-xl border border-emerald-200 bg-white p-6 shadow-sm"
      role="status"
    >
      <h1 className="text-2xl font-semibold text-stone-900">
        Registration submitted
      </h1>
      <p className="mt-3 text-sm text-stone-600">
        Your registration for {vendorName} is awaiting platform approval. You
        can sign in after an administrator approves the account.
      </p>
    </div>
  );
}

export function VendorRegistrationForm({
  vendorName,
  maskedMobile,
}: VendorRegistrationFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const token = new URL(window.location.href).searchParams.get("token") ?? "";

    try {
      const response = await fetch("/api/auth/vendor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          contactName: formData.get("contactName"),
          ...(email ? { email } : {}),
          password: formData.get("password"),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error?.message ?? "Registration failed");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return <VendorRegistrationSubmitted vendorName={vendorName} />;
  }

  return (
    <div className="rounded-xl border border-stone-200/90 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Register {vendorName}
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        Create the primary vendor contact. Registration does not sign you in.
      </p>

      <dl className="mt-5 rounded-lg bg-stone-50 p-4 text-sm">
        <div>
          <dt className="font-medium text-stone-700">Registered mobile</dt>
          <dd className="mt-1 text-stone-900">{maskedMobile}</dd>
        </div>
      </dl>

      <noscript>
        <p className="mt-4 text-sm text-red-600">
          JavaScript is required to submit registration.
        </p>
      </noscript>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Contact name</span>
          <input
            className={`mt-1 ${inputClass}`}
            name="contactName"
            type="text"
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-stone-800">Email (optional)</span>
          <input
            className={`mt-1 ${inputClass}`}
            name="email"
            type="email"
            maxLength={255}
            autoComplete="email"
          />
        </label>

        <PasswordField
          label="Password"
          name="password"
          required
          maxLength={128}
          autoComplete="new-password"
        />
        <p className="text-xs text-stone-500">
          At least 10 characters, or 8+ with uppercase, lowercase, and a number.
        </p>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full ${primaryButtonClass}`}
        >
          {isSubmitting ? "Submitting..." : "Submit for approval"}
        </button>
      </form>
    </div>
  );
}
