"use client";

import Link from "next/link";

import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass } from "@/components/ui/page";
import { getDocumentTemplatesDict } from "@/lib/i18n/dictionaries/document-templates";
import { useLocale } from "@/lib/i18n/use-locale";

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
  const dict = getDocumentTemplatesDict(useLocale()).generatePanel;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-stone-900">{dict.title}</h2>
        <p className="text-xs text-stone-500">{dict.hint}</p>
      </div>

      {variableNames.length === 0 ? (
        <p className="text-xs text-stone-500">{dict.noVariables}</p>
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
          {dict.generatedSaved}{" "}
          <Link href="/dashboard/generated-documents" className="underline">
            {dict.viewInGenerated}
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
          {generating ? dict.generating : dict.generate}
        </button>
      </div>
    </div>
  );
}
