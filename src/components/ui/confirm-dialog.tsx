"use client";

import type { ReactNode } from "react";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/page";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Reusable confirm modal — replaces window.confirm() for risky admin actions. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-stone-900"
        >
          {title}
        </h2>
        <div className="mt-2 text-sm leading-relaxed text-stone-700">
          {message}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
