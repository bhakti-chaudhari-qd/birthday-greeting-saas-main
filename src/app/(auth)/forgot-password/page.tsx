"use client";

import { useState } from "react";

import {
  SecondaryButtonLink,
  inputClass,
  primaryButtonClass,
} from "@/components/ui/page";

export default function ForgotPasswordPage() {
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
        setError(payload.error?.message ?? "Too many attempts. Try again later.");
        return;
      }

      if (!response.ok) {
        setError(payload.error?.message ?? "Request failed");
        return;
      }

      setMessage(
        payload.data?.message ??
          "If an account exists for that email, a reset link has been sent.",
      );
    } catch {
      setError("Request failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-stone-200/90 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Forgot password
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        Enter your organization account email. We’ll send a one-hour reset link
        if the account exists.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Email</span>
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
          {isSubmitting ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <div className="mt-4">
        <SecondaryButtonLink href="/login">Back to sign in</SecondaryButtonLink>
      </div>
    </div>
  );
}
