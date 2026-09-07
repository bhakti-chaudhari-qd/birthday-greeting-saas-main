"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass } from "@/components/ui/page";

export function CreateVendorForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/admin/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mobile }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const vendorId = payload.error?.details?.vendorId;
        if (typeof vendorId === "string") {
          router.push(`/admin/vendors/${vendorId}`);
          router.refresh();
          return;
        }
        setError(payload.error?.message ?? "Failed to create vendor");
        return;
      }

      router.push(`/admin/vendors/${payload.data.vendor.id}`);
      router.refresh();
    } catch {
      setError("Failed to create vendor");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Vendor name</span>
        <input
          name="name"
          className={`mt-1 ${inputClass}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={100}
          required
          autoFocus
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Mobile</span>
        <input
          name="mobile"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className={`mt-1 ${inputClass}`}
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          placeholder="98765 43210"
          required
        />
        <span className="mt-1 block text-xs text-stone-500">
          The registration invitation is sent by SMS.
        </span>
      </label>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      <button
        type="submit"
        disabled={submitting}
        className={primaryButtonClass}
      >
        {submitting ? "Creating and sending…" : "Create vendor and send SMS"}
      </button>
    </form>
  );
}
