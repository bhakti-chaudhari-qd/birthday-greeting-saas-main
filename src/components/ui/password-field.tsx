"use client";

import { useState } from "react";

import { inputClass } from "@/components/ui/page";

type PasswordFieldProps = {
  label: string;
  name: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  autoComplete?: string;
};

/** Password input with a Show/Hide toggle. */
export function PasswordField({
  label,
  name,
  required,
  minLength,
  maxLength,
  autoComplete,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block text-sm">
      <span className="font-medium text-stone-800">{label}</span>
      <div className="relative mt-1">
        <input
          className={`${inputClass} pr-16`}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-stone-600 hover:text-stone-900"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </label>
  );
}
