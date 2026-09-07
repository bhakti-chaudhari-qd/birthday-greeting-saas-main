"use client";

import { useEffect, useState } from "react";

import { inputClass } from "@/components/ui/page";

export type MaskedPasswordFieldProps = {
  /** True when the server already has credentials stored for this channel. */
  configured: boolean;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
  /** Field label, e.g. "Password" or "API Key". Defaults to "Password". */
  label?: string;
};

/**
 * Standard SaaS secret UX: once a value is on file, show a masked
 * placeholder + "Change <label>" instead of an empty, always-editable input.
 * The field only becomes editable (and only then gets sent to the server)
 * after the user explicitly asks to change it. Generic over its label so it
 * can front any single secret value (password, API key, ...).
 */
export function MaskedPasswordField({
  configured,
  value,
  onChange,
  required = false,
  hint,
  label = "Password",
}: MaskedPasswordFieldProps) {
  const [editing, setEditing] = useState(!configured);

  useEffect(() => {
    function syncEditingWithConfigured() {
      setEditing(!configured);
    }
    syncEditingWithConfigured();
  }, [configured]);

  if (configured && !editing) {
    return (
      <div className="block text-sm">
        <span className="font-medium text-stone-800">{label}</span>
        <div className="mt-1 flex items-center justify-between gap-3 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2">
          <span className="tracking-widest text-stone-500">••••••••••••</span>
          <button
            type="button"
            className="shrink-0 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={() => setEditing(true)}
          >
            Change {label}
          </button>
        </div>
      </div>
    );
  }

  return (
    <label className="block text-sm">
      <span className="font-medium text-stone-800">
        {configured ? `New ${label}` : label}
      </span>
      <input
        type="password"
        className={`${inputClass} mt-1`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="new-password"
        required={required && !configured}
      />
      {hint ? <span className="mt-1 block text-xs text-stone-500">{hint}</span> : null}
      {configured ? (
        <button
          type="button"
          className="mt-1 text-xs font-medium text-stone-500 outline-none hover:text-stone-800 hover:underline"
          onClick={() => {
            setEditing(false);
            onChange("");
          }}
        >
          Cancel
        </button>
      ) : null}
    </label>
  );
}
