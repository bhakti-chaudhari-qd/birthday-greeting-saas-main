"use client";

import {
  BUILTIN_TEMPLATE_VARIABLES,
  TEMPLATE_VARIABLE_LABELS,
} from "@/lib/templates/variables";

export type VariablePanelProps = {
  disabled: boolean;
  onInsert: (variableName: string) => void;
};

/** Just text insertion at the cursor - no mapping, no config, no preview data. */
export function VariablePanel({ disabled, onInsert }: VariablePanelProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
      <span className="text-xs font-medium text-stone-600">
        {disabled ? "Click into a text box to insert a variable:" : "Insert variable:"}
      </span>
      {BUILTIN_TEMPLATE_VARIABLES.map((variable) => (
        <button
          key={variable}
          type="button"
          disabled={disabled}
          className="rounded-full border border-sky-300 bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-900 outline-none transition-colors hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onInsert(variable)}
        >
          {TEMPLATE_VARIABLE_LABELS[variable]}
        </button>
      ))}
    </div>
  );
}
