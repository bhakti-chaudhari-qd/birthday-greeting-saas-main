"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/page";
import { PasswordField } from "@/components/ui/password-field";
import { getAdminClientDetailDict } from "@/lib/i18n/dictionaries/admin-client-detail";
import { useLocale } from "@/lib/i18n/use-locale";

export function AddOrganizationUserForm({
  organizationId,
}: {
  organizationId: string;
}) {
  const router = useRouter();
  const dict = getAdminClientDetailDict(useLocale());
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
        setError(body.error?.message ?? dict.addUser.failedToAdd);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError(dict.addUser.failedToAdd);
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
          {dict.usersTable.addUser}
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-stone-200 px-5 py-4 sm:px-6">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">{dict.addUser.name}</span>
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
          <span className="font-medium text-stone-800">{dict.addUser.role}</span>
          <select name="role" className={`mt-1 ${inputClass}`} defaultValue="STAFF">
            <option value="STAFF">{dict.addUser.staff}</option>
            <option value="ADMIN">{dict.addUser.owner}</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">{dict.addUser.email}</span>
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
            {dict.addUser.mobile} {dict.addUser.optional}
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
            label={dict.addUser.initialPassword}
            name="password"
            required
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-stone-500">{dict.addUser.passwordHint}</p>
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
            {submitting ? dict.addUser.adding : dict.addUser.add}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className={secondaryButtonClass}
          >
            {dict.addUser.cancel}
          </button>
        </div>
      </form>
    </div>
  );
}
