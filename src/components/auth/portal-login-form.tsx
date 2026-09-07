"use client";

import Link from "next/link";
import { useState } from "react";

import { primaryButtonClass, inputClass } from "@/components/ui/page";
import { PasswordField } from "@/components/ui/password-field";

type PortalLoginFormProps = {
  title: string;
  description: string;
  loginApiPath: string;
  landingPath: string;
  homeHint?: string;
};

export function PortalLoginForm({
  title,
  description,
  loginApiPath,
  landingPath,
  homeHint,
}: PortalLoginFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(loginApiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error?.message ?? "Login failed");
        return;
      }

      window.location.assign(landingPath);
    } catch {
      setError("Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-stone-200/90 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        {title}
      </h1>
      <p className="mt-2 text-sm text-stone-600">{description}</p>

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

      <p className="mt-4 text-sm text-stone-600">
        {homeHint ?? "Wrong portal?"}{" "}
        <Link className="font-medium text-primary underline" href="/">
          Choose a portal
        </Link>
      </p>
    </div>
  );
}
