"use client";

import { useState } from "react";

import {
  SecondaryButtonLink,
  inputClass,
  primaryButtonClass,
} from "@/components/ui/page";
import { PasswordField } from "@/components/ui/password-field";

type LoginResponse = {
  data?: {
    redirectTo?: string;
  };
  error?: {
    message?: string;
  };
};

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: formData.get("identifier"),
          password: formData.get("password"),
        }),
      });

      const payload = (await response.json()) as LoginResponse;

      if (!response.ok) {
        setError(payload.error?.message ?? "Login failed");
        return;
      }

      window.location.assign(payload.data?.redirectTo ?? "/dashboard");
    } catch {
      setError("Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-stone-200/90 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        Sign in
      </h1>
      <p className="mt-2 text-sm text-stone-600">
        Use your email or Indian mobile number and password. We’ll route you to
        the right workspace.
      </p>

      <noscript>
        <p className="mt-4 text-sm text-red-600">
          JavaScript is required to sign in.
        </p>
      </noscript>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit} method="dialog">
        <label className="block text-sm">
          <span className="font-medium text-stone-800">
            Email or Indian mobile
          </span>
          <input
            className={`mt-1 ${inputClass}`}
            name="identifier"
            type="text"
            autoComplete="username"
            inputMode="email"
            required
          />
        </label>

        <PasswordField
          label="Password"
          name="password"
          required
          autoComplete="current-password"
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full ${primaryButtonClass}`}
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <SecondaryButtonLink href="/forgot-password">
          Forgot password
        </SecondaryButtonLink>
        <SecondaryButtonLink href="/register">Register</SecondaryButtonLink>
      </div>
    </div>
  );
}
