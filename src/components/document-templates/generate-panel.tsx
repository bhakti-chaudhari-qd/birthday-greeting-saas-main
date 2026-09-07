"use client";

import Link from "next/link";

import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass } from "@/components/ui/page";

export type GeneratePanelProps = {
  variableNames: string[];
  values: Record<string, string>;
  onValueChange: (name: string, value: string) => void;
  onGenerate: () => void;
  generating: boolean;
  error: string | null;
  success: boolean;
};

export function GeneratePanel({
  variableNames,
  values,
  onValueChange,
  onGenerate,
  generating,
  error,
  success,
}: GeneratePanelProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-stone-900">Generate PDF</h2>
        <p className="text-xs text-stone-500">
          Fill in the values below, then generate a personalized PDF. It&apos;s
          saved for 7 days in Generated Documents.
        </p>
      </div>

      {variableNames.length === 0 ? (
        <p className="text-xs text-stone-500">
          This layout has no variables - generating will use the text as written.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {variableNames.map((name) => (
            <label key={name} className="block text-sm">
              <span className="font-medium text-stone-800">{name}</span>
              <input
                className={`${inputClass} mt-1`}
                value={values[name] ?? ""}
                onChange={(event) => onValueChange(name, event.target.value)}
              />
            </label>
          ))}
        </div>
      )}

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {success ? (
        <InlineAlert tone="success">
          Generated and saved.{" "}
          <Link href="/dashboard/generated-documents" className="underline">
            View in Generated Documents
          </Link>
          .
        </InlineAlert>
      ) : null}

      <div>
        <button
          type="button"
          className={primaryButtonClass}
          onClick={onGenerate}
          disabled={generating}
        >
          {generating ? "Generating..." : "Generate PDF"}
        </button>
      </div>
    </div>
  );
}
