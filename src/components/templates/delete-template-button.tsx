"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeleteTemplateButtonProps = {
  templateId: string;
  templateName: string;
};

export function DeleteTemplateButton({
  templateId,
  templateName,
}: DeleteTemplateButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${templateName}"? This cannot be undone.`,
    );
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
        setError(body.error?.message ?? "Failed to delete template");
        return;
      }

      router.push("/dashboard/templates");
      router.refresh();
    } catch {
      setError("Failed to delete template");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <h2 className="text-sm font-semibold text-red-900">Delete template</h2>
      <p className="mt-1 text-sm leading-relaxed text-red-800">
        Permanent. Templates with message history can&apos;t be deleted.
      </p>
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
        {deleting ? "Deleting..." : "Delete template"}
      </button>
    </div>
  );
}