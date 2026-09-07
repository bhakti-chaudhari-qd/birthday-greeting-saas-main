"use client";

import Link from "next/link";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/page";

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
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold text-stone-900">{templateName}</h1>
        <p className="text-xs text-stone-500">
          Drag text boxes onto the PDF, then save the layout.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {saved ? <span className="text-xs text-emerald-700">Saved</span> : null}
        <Link href="/dashboard/document-templates" className={secondaryButtonClass}>
          Back
        </Link>
        <button type="button" className={secondaryButtonClass} onClick={onAddText}>
          Add Text
        </button>
        <button
          type="button"
          className={primaryButtonClass}
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Layout"}
        </button>
      </div>
    </div>
  );
}
