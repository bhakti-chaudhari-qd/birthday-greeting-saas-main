"use client";

import Link from "next/link";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/page";
import { getDocumentTemplatesDict } from "@/lib/i18n/dictionaries/document-templates";
import { useLocale } from "@/lib/i18n/use-locale";

export type EditorToolbarProps = {
  templateName: string;
  saving: boolean;
  saved: boolean;
  onAddText: () => void;
  onSave: () => void;
};

export function EditorToolbar({
  templateName,
  saving,
  saved,
  onAddText,
  onSave,
}: EditorToolbarProps) {
  const dict = getDocumentTemplatesDict(useLocale()).toolbar;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold text-stone-900">{templateName}</h1>
        <p className="text-xs text-stone-500">{dict.hint}</p>
      </div>
      <div className="flex items-center gap-2">
        {saved ? <span className="text-xs text-emerald-700">{dict.saved}</span> : null}
        <Link href="/dashboard/document-templates" className={secondaryButtonClass}>
          {dict.back}
        </Link>
        <button type="button" className={secondaryButtonClass} onClick={onAddText}>
          {dict.addText}
        </button>
        <button
          type="button"
          className={primaryButtonClass}
          onClick={onSave}
          disabled={saving}
        >
          {saving ? dict.saving : dict.saveLayout}
        </button>
      </div>
    </div>
  );
}
