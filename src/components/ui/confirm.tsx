"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { Locale } from "@/lib/i18n/constants";
import { useLocale } from "@/lib/i18n/use-locale";

export type ConfirmOptions = {
  /** The question being asked, e.g. "Delete this contact?". */
  message: string;
  title?: string;
  confirmLabel?: string;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

const CONFIRM_LABELS: Record<
  Locale,
  { title: string; confirm: string; cancel: string }
> = {
  en: { title: "Please confirm", confirm: "Confirm", cancel: "Cancel" },
  hi: { title: "कृपया पुष्टि करें", confirm: "पुष्टि करें", cancel: "रद्द करें" },
  mr: { title: "कृपया खात्री करा", confirm: "खात्री करा", cancel: "रद्द करा" },
};

/**
 * Hosts one in-app confirm dialog for the whole tree. `useConfirm()` returns
 * a function that opens it and resolves to the user's choice, so a handler
 * can `await` it the same way it used to call window.confirm().
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const labels = CONFIRM_LABELS[useLocale()];
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    // A second request while one is open cancels the first.
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function settle(confirmed: boolean) {
    resolver.current?.(confirmed);
    resolver.current = null;
    setOptions(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={options !== null}
        title={options?.title ?? labels.title}
        message={options?.message ?? ""}
        confirmLabel={options?.confirmLabel ?? labels.confirm}
        cancelLabel={labels.cancel}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

/** Falls back to the browser dialog when rendered outside a ConfirmProvider. */
export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  return (
    confirm ?? ((options) => Promise.resolve(window.confirm(options.message)))
  );
}
