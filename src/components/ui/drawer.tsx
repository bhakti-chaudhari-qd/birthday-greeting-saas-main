"use client";

import { useEffect, type ReactNode } from "react";

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Sticky footer, e.g. Cancel/Save buttons. */
  footer?: ReactNode;
};

/**
 * Right-side sliding panel for focused create/edit flows.
 * Same interaction contract as Modal (Escape / backdrop to close, body scroll lock).
 */
export function Drawer({ open, onClose, title, description, children, footer }: DrawerProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 bg-stone-900/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-xl sm:max-w-lg"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-stone-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-stone-900">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-stone-500">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1 text-stone-400 outline-none transition-colors hover:bg-stone-100 hover:text-stone-700 focus-visible:ring-2 focus-visible:ring-primary"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div className="flex shrink-0 justify-end gap-2 border-t border-stone-200 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
