"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/modal";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/page";
import { invalidateOrganizationCategories } from "@/lib/client/organization-reference-data";
import { getContactsDict } from "@/lib/i18n/dictionaries/contacts";
import { useLocale } from "@/lib/i18n/use-locale";

export type OrgCategory = {
  id: string;
  name: string;
};

export type CreateCategoryModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (category: OrgCategory) => void;
};

export function CreateCategoryModal({
  open,
  onClose,
  onCreated,
}: CreateCategoryModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dict = getContactsDict(useLocale()).categoryModal;

  function handleClose() {
    setName("");
    setError(null);
    onClose();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError(dict.categoryNameRequired);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/contact-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? dict.couldNotCreateCategory);
        return;
      }

      invalidateOrganizationCategories();
      onCreated(body.data as OrgCategory);
      setName("");
    } catch {
      setError(dict.couldNotCreateCategoryConn);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={dict.title}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">{dict.categoryName}</span>
          <input
            className={`${inputClass} mt-1`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={dict.categoryNamePlaceholder}
            maxLength={50}
            autoFocus
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={handleClose}
            disabled={submitting}
          >
            {dict.cancel}
          </button>
          <button type="submit" className={primaryButtonClass} disabled={submitting}>
            {submitting ? dict.creating : dict.create}
          </button>
        </div>
      </form>
    </Modal>
  );
}
