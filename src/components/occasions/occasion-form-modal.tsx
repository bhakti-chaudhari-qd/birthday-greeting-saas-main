"use client";

import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/page";
import { getOccasionsDict } from "@/lib/i18n/dictionaries/occasions";
import { useLocale } from "@/lib/i18n/use-locale";

export type OccasionFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  occasionId?: string;
  initialName?: string;
  onClose: () => void;
  onSaved: () => void;
};

export function OccasionFormModal({
  open,
  mode,
  occasionId,
  initialName,
  onClose,
  onSaved,
}: OccasionFormModalProps) {
  const dict = getOccasionsDict(useLocale()).form;
  const [name, setName] = useState(initialName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function resetForm() {
      setName(initialName ?? "");
      setError(null);
    }
    if (open) {
      resetForm();
    }
  }, [open, initialName]);

  function handleClose() {
    if (submitting) return;
    onClose();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError(dict.nameRequired);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        mode === "create" ? "/api/v1/occasions" : `/api/v1/occasions/${occasionId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        },
      );
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? dict.couldNotSave);
        return;
      }

      onSaved();
    } catch {
      setError(dict.couldNotSaveConnection);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={mode === "create" ? dict.addOccasionTitle : dict.editOccasionTitle}
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">{dict.occasionName}</span>
          <input
            className={`${inputClass} mt-1`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={dict.namePlaceholder}
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
            {submitting
              ? dict.saving
              : mode === "create"
                ? dict.addOccasionAction
                : dict.saveChanges}
          </button>
        </div>
      </form>
    </Modal>
  );
}
