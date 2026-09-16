"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import {
  SecondaryButtonLink,
  primaryButtonClass,
} from "@/components/ui/page";
import { PasswordField } from "@/components/ui/password-field";
import { getAuthDict } from "@/lib/i18n/dictionaries/auth";
import { useLocale } from "@/lib/i18n/use-locale";

function ResetPasswordForm() {
  const dict = getAuthDict(useLocale()).resetPassword;
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    const token = String(formData.get("token") ?? tokenFromUrl);

    if (password !== confirm) {
      setError(dict.fallbackMismatch);
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error?.message ?? dict.fallbackError);
        return;
      }

      setMessage(payload.data?.message ?? dict.fallbackUpdated);
    } catch {
      setError(dict.fallbackError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-stone-200/90 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        {dict.title}
      </h1>
      <p className="mt-2 text-sm text-stone-600">{dict.subtitle}</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <input type="hidden" name="token" value={tokenFromUrl} />
        <PasswordField
          label={dict.newPasswordLabel}
          name="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
        />
        <PasswordField
          label={dict.confirmPasswordLabel}
          name="confirm"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting || !tokenFromUrl}
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

export default function ResetPasswordPage() {
  const dict = getAuthDict(useLocale()).resetPassword;
  return (
    <Suspense fallback={<p className="text-sm text-stone-600">{dict.loading}</p>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
