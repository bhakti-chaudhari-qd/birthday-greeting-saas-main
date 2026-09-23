"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/page";
import { PasswordField } from "@/components/ui/password-field";

export function AddOrganizationUserForm({
  organizationId,
}: {
  organizationId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(
        `/api/v1/admin/organizations/${organizationId}/users`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.get("name"),
            email: formData.get("email"),
            mobile: (formData.get("mobile") as string)?.trim() || undefined,
            password: formData.get("password"),
            role: formData.get("role"),
          }),
        },
      );
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? "Failed to add user");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Failed to add user");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="border-b border-stone-200 px-5 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={secondaryButtonClass}
        >
          + Add user
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-stone-200 px-5 py-4 sm:px-6">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Name</span>
          <input
            name="name"
            className={`mt-1 ${inputClass}`}
            minLength={2}
            maxLength={100}
            required
            autoFocus
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Role</span>
          <select name="role" className={`mt-1 ${inputClass}`} defaultValue="STAFF">
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Owner</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Email</span>
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
          <span className="font-medium text-stone-800">
            Mobile (optional)
          </span>
          <input
            name="mobile"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            className={`mt-1 ${inputClass}`}
            placeholder="10-digit mobile number"
          />
        </label>
        <div className="sm:col-span-2">
          <PasswordField
            label="Initial password"
            name="password"
            required
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-stone-500">
            At least 10 characters, or 8+ with uppercase, lowercase, and a
            number. Share it with the client securely.
          </p>
        </div>

        {error ? (
          <div className="sm:col-span-2">
            <InlineAlert tone="error">{error}</InlineAlert>
          </div>
        ) : null}

        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className={primaryButtonClass}
          >
            {submitting ? "Adding…" : "Add user"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
