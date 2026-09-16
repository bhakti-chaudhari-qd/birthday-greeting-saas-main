"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  SecondaryButtonLink,
  primaryButtonClass,
} from "@/components/ui/page";
import { PasswordField } from "@/components/ui/password-field";
import { navigateToAuthenticatedLanding } from "@/lib/auth/navigate-after-auth";
import { getAuthDict } from "@/lib/i18n/dictionaries/auth";
import { useLocale } from "@/lib/i18n/use-locale";

function RegisterForm() {
  const dict = getAuthDict(useLocale()).register;
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
        setError(payload.error?.message ?? dict.fallbackError);
        return;
      }

      navigateToAuthenticatedLanding();
    } catch {
      setError(dict.fallbackError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-zinc-900">{dict.title}</h1>
      <p className="mt-2 text-sm text-zinc-600">{dict.subtitle}</p>

      <noscript>
        <p className="mt-4 text-sm text-red-600">{dict.jsRequired}</p>
      </noscript>

      <form
        className="mt-6 space-y-4"
        onSubmit={handleSubmit}
        method="dialog"
      >
        <Field label={dict.organizationNameLabel} name="organizationName" required />
        <Field label={dict.ownerNameLabel} name="adminName" required />
        <Field label={dict.emailLabel} name="email" type="email" required />
        <PasswordField
          label={dict.passwordLabel}
          name="password"
          required
          autoComplete="new-password"
        />
        <p className="text-xs text-zinc-500">{dict.passwordHint}</p>
        <Field
          label={dict.referralLabel}
          name="referralCode"
          placeholder={dict.referralPlaceholder}
          defaultValue={referralFromQuery}
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full ${primaryButtonClass}`}
        >
          {isSubmitting ? dict.submitting : dict.submit}
        </button>
      </form>

      <div className="mt-4">
        <SecondaryButtonLink href="/login">{dict.signIn}</SecondaryButtonLink>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const dict = getAuthDict(useLocale()).register;
  return (
    <Suspense fallback={<p className="text-sm text-stone-600">{dict.loading}</p>}>
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
