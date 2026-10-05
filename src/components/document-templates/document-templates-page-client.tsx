"use client";

import { useEffect, useRef, useState } from "react";

import { InlineAlert, StatusBadge } from "@/components/ui/feedback";
import {
  PageHeader,
  PageShell,
  Panel,
  SecondaryButtonLink,
  compactSecondaryButtonClass,
  inputClass,
  primaryButtonClass,
} from "@/components/ui/page";
import { getDocumentTemplatesDict } from "@/lib/i18n/dictionaries/document-templates";
import { translateOccasionName } from "@/lib/i18n/occasion-labels";
import { useLocale } from "@/lib/i18n/use-locale";

type DocumentTemplate = {
  id: string;
  name: string;
  occasionId: string | null;
  occasionName: string | null;
  fileName: string;
  byteLength: number;
  fileUrl: string;
  isActive: boolean;
  createdAt: string;
};

type OccasionOption = {
  id: string;
  name: string;
};

const emptyUploadForm = { name: "", occasionId: "" };

function formatBytes(byteLength: number): string {
  if (byteLength < 1024) {
    return `${byteLength} B`;
  }
  return `${(byteLength / 1024).toFixed(1)} KB`;
}

/**
 * List + upload/rename/delete panel, with no page shell of its own - reused
 * both by the standalone /document-templates route and embedded as the
 * "Document Templates" tab on /dashboard/templates, so there is exactly one
 * implementation of this behavior.
 */
export function DocumentTemplatesManager() {
  const locale = useLocale();
  const dict = getDocumentTemplatesDict(locale).pageList;
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [occasions, setOccasions] = useState<OccasionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadForm, setUploadForm] = useState(emptyUploadForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadTemplates() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/document-templates");
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? dict.couldNotLoad);
        return;
      }
      setTemplates(body.data as DocumentTemplate[]);
    } catch {
      setError(dict.couldNotLoadConn);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadInitialTemplates() {
      await loadTemplates();
    }
    async function loadOccasionOptions() {
      try {
        const response = await fetch("/api/v1/occasions");
        const body = await response.json();
        if (response.ok) {
          setOccasions(body.data as OccasionOption[]);
        }
      } catch {
        // Occasion list is optional context for the upload form; ignore failures.
      }
    }
    void loadInitialTemplates();
    void loadOccasionOptions();
  }, []);

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError(dict.chooseFile);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("name", uploadForm.name);
      if (uploadForm.occasionId) {
        formData.set("occasionId", uploadForm.occasionId);
      }

      const response = await fetch("/api/v1/document-templates", {
        method: "POST",
        body: formData,
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? dict.couldNotUpload);
        return;
      }

      setUploadForm(emptyUploadForm);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await loadTemplates();
    } catch {
      setError(dict.couldNotUploadConn);
    } finally {
      setUploading(false);
    }
  }

  function startEdit(template: DocumentTemplate) {
    setEditingId(template.id);
    setEditingName(template.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function saveEdit(templateId: string) {
    setError(null);
    try {
      const response = await fetch(`/api/v1/document-templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? dict.couldNotRename);
        return;
      }
      cancelEdit();
      await loadTemplates();
    } catch {
      setError(dict.couldNotRenameConn);
    }
  }

  async function handleDelete(template: DocumentTemplate) {
    const confirmed = window.confirm(dict.confirmDelete(template.name));
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`/api/v1/document-templates/${template.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json();
        setError(body.error?.message ?? dict.couldNotDelete);
        return;
      }
      await loadTemplates();
    } catch {
      setError(dict.couldNotDeleteConn);
    }
  }

  return (
    <>
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <Panel className="p-4">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]"
          onSubmit={handleUpload}
        >
          <label className="block text-sm">
            <span className="font-medium text-stone-800">{dict.nameLabel}</span>
            <input
              className={`${inputClass} mt-1`}
              value={uploadForm.name}
              onChange={(event) =>
                setUploadForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder={dict.namePlaceholder}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">{dict.occasionLabel}</span>
            <select
              className={`${inputClass} mt-1`}
              value={uploadForm.occasionId}
              onChange={(event) =>
                setUploadForm((current) => ({
                  ...current,
                  occasionId: event.target.value,
                }))
              }
            >
              <option value="">{dict.noneOption}</option>
              {occasions.map((occasion) => (
                <option key={occasion.id} value={occasion.id}>
                  {translateOccasionName(occasion.name, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">{dict.pdfFileLabel}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className={`${inputClass} mt-1 file:mr-3 file:rounded-full file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium`}
              required
            />
          </label>
          <div className="flex items-end">
            <button type="submit" className={primaryButtonClass} disabled={uploading}>
              {uploading ? dict.uploading : dict.upload}
            </button>
          </div>
        </form>
      </Panel>

      <Panel>
        {loading ? (
          <p className="p-6 text-sm text-stone-600">{dict.loading}</p>
        ) : templates.length === 0 ? (
          <p className="p-6 text-sm text-stone-600">{dict.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{dict.colName}</th>
                  <th className="px-4 py-2.5 font-medium">{dict.colOccasion}</th>
                  <th className="px-4 py-2.5 font-medium">{dict.colFile}</th>
                  <th className="px-4 py-2.5 font-medium">{dict.colStatus}</th>
                  <th className="px-4 py-2.5 font-medium">
                    <span className="sr-only">{dict.colActionsSr}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-stone-900">
                      {editingId === template.id ? (
                        <input
                          className={inputClass}
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          autoFocus
                        />
                      ) : (
                        template.name
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-stone-600">
                      {template.occasionName
                        ? translateOccasionName(template.occasionName, locale)
                        : dict.emptyDash}
                    </td>
                    <td className="px-4 py-2.5 text-stone-600">
                      {template.fileName} ({formatBytes(template.byteLength)})
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={template.isActive ? dict.active : dict.inactive}
                        tone={template.isActive ? "success" : "neutral"}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        {editingId === template.id ? (
                          <>
                            <button
                              type="button"
                              className={compactSecondaryButtonClass}
                              onClick={() => void saveEdit(template.id)}
                            >
                              {dict.save}
                            </button>
                            <button
                              type="button"
                              className={compactSecondaryButtonClass}
                              onClick={cancelEdit}
                            >
                              {dict.cancel}
                            </button>
                          </>
                        ) : (
                          <>
                            <a
                              href={template.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={compactSecondaryButtonClass}
                            >
                              {dict.preview}
                            </a>
                            <a
                              href={`/dashboard/document-templates/${template.id}/edit`}
                              className={compactSecondaryButtonClass}
                            >
                              {dict.editLayout}
                            </a>
                            <button
                              type="button"
                              className={compactSecondaryButtonClass}
                              onClick={() => startEdit(template)}
                            >
                              {dict.rename}
                            </button>
                            <button
                              type="button"
                              className={compactSecondaryButtonClass}
                              onClick={() => void handleDelete(template)}
                            >
                              {dict.delete}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

/** Standalone /document-templates route - kept for backward compatibility. */
export function DocumentTemplatesPageClient() {
  const dict = getDocumentTemplatesDict(useLocale()).pageList;
  return (
    <PageShell>
      <PageHeader
        title={dict.title}
        description={dict.description}
        actions={
          <SecondaryButtonLink href="/dashboard/generated-documents">
            {dict.generatedDocuments}
          </SecondaryButtonLink>
        }
      />
      <DocumentTemplatesManager />
    </PageShell>
  );
}
