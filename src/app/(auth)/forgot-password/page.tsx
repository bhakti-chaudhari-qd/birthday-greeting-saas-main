"use client";

import { useState } from "react";

import {
  SecondaryButtonLink,
  inputClass,
  primaryButtonClass,
} from "@/components/ui/page";
import { getAuthDict } from "@/lib/i18n/dictionaries/auth";
import { useLocale } from "@/lib/i18n/use-locale";

export default function ForgotPasswordPage() {
  const dict = getAuthDict(useLocale()).forgotPassword;
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.get("email") }),
      });
      const payload = await response.json();

      if (response.status === 429) {
        setError(payload.error?.message ?? dict.fallbackTooMany);
        return;
      }

      if (!response.ok) {
        setError(payload.error?.message ?? dict.fallbackError);
        return;
      }

      setMessage(payload.data?.message ?? dict.fallbackSent);
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
        <label className="block text-sm">
          <span className="font-medium text-stone-800">{dict.emailLabel}</span>
          <input
            className={`mt-1 ${inputClass}`}
            name="email"
            type="email"
            required
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full ${primaryButtonClass}`}
        >
          {isSubmitting ? dict.submitting : dict.submit}
        </button>
      </form>

      <div className="mt-4">
        <SecondaryButtonLink href="/login">{dict.backToSignIn}</SecondaryButtonLink>
      </div>
    </div>
  );
}
