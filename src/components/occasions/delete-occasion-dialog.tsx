"use client";

import { useEffect, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { InlineAlert } from "@/components/ui/feedback";
import { secondaryButtonClass } from "@/components/ui/page";

export type DeleteOccasionDialogProps = {
  open: boolean;
  occasionId: string | null;
  occasionName: string;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteOccasionDialog({
  open,
  occasionId,
  occasionName,
  onClose,
  onDeleted,
}: DeleteOccasionDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    function resetState() {
      setError(null);
      setReasons([]);
    }
    if (open) {
      resetState();
    }
  }, [open]);

  function handleClose() {
    if (deleting) return;
    onClose();
  }

  async function handleConfirm() {
    if (!occasionId) return;
    setDeleting(true);
    setError(null);
    setReasons([]);

    try {
      const response = await fetch(`/api/v1/occasions/${occasionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error?.message ?? "Could not delete occasion");
        setReasons((body.error?.details?.reasons as string[] | undefined) ?? []);
        return;
      }

      onDeleted();
    } catch {
      setError("Could not delete occasion. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Delete this occasion?">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-stone-700">
          {`"${occasionName}" will be permanently removed. This cannot be undone.`}
        </p>

        {error ? (
          <InlineAlert tone="error">
            {error}
            {reasons.length > 0 ? (
              <ul className="mt-1.5 list-disc pl-5">
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
          </InlineAlert>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={handleClose}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white outline-none transition-colors hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={deleting}
            onClick={() => void handleConfirm()}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
