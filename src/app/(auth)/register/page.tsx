"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  SecondaryButtonLink,
  primaryButtonClass,
} from "@/components/ui/page";
import { PasswordField } from "@/components/ui/password-field";
import { navigateToAuthenticatedLanding } from "@/lib/auth/navigate-after-auth";

function RegisterForm() {
  const searchParams = useSearchParams();
  const referralFromQuery = searchParams.get("ref")?.trim() ?? "";
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Wake a sleeping Neon Free DB while the user fills the form.
    void fetch("/api/v1/health", { cache: "no-store" }).catch(() => {});
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: formData.get("organizationName"),
          adminName: formData.get("adminName"),
          email: formData.get("email"),
          password: formData.get("password"),
          referralCode: formData.get("referralCode") || undefined,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error?.message ?? "Registration failed");
        return;
      }

      navigateToAuthenticatedLanding();
    } catch {
      setError("Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-zinc-900">Register organization</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Create your organization and Owner account.
      </p>

      <noscript>
        <p className="mt-4 text-sm text-red-600">
          JavaScript is required to create an account.
        </p>
      </noscript>

      <form
        className="mt-6 space-y-4"
        onSubmit={handleSubmit}
        method="dialog"
      >
        <Field label="Organization name" name="organizationName" required />
        <Field label="Owner name" name="adminName" required />
        <Field label="Email" name="email" type="email" required />
        <PasswordField
          label="Password"
          name="password"
          required
          autoComplete="new-password"
        />
        <p className="text-xs text-zinc-500">
          At least 10 characters, or 8+ with uppercase, lowercase, and a number.
        </p>
        <Field
          label="Referral code"
          name="referralCode"
          placeholder="From your partner, if you have one"
          defaultValue={referralFromQuery}
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full ${primaryButtonClass}`}
        >
          {isSubmitting ? "Creating..." : "Create account"}
        </button>
      </form>

      <div className="mt-4">
        <SecondaryButtonLink href="/login">Sign in</SecondaryButtonLink>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-600">Loading…</p>}>
      <RegisterForm />
    </Suspense>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-zinc-800">{label}</span>
      <input
        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
      />
    </label>
  );
}
