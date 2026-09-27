"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { getTemplatesDict } from "@/lib/i18n/dictionaries/templates";
import { useLocale } from "@/lib/i18n/use-locale";

type DeleteTemplateButtonProps = {
  templateId: string;
  templateName: string;
};

export function DeleteTemplateButton({
  templateId,
  templateName,
}: DeleteTemplateButtonProps) {
  const dict = getTemplatesDict(useLocale()).deleteButton;
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(dict.confirmPrompt(templateName));
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/templates/${templateId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json();
        setError(body.error?.message ?? dict.failedToDelete);
        return;
      }

      router.push("/dashboard/templates");
      router.refresh();
    } catch {
      setError(dict.failedToDelete);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <h2 className="text-sm font-semibold text-red-900">{dict.title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-red-800">{dict.description}</p>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-red-800">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="mt-4 rounded-full bg-red-700 px-4 py-2 text-sm font-medium text-white outline-none hover:bg-red-800 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={deleting}
        onClick={() => void handleDelete()}
      >
        {deleting ? dict.deleting : dict.deleteTemplate}
      </button>
    </div>
  );
}