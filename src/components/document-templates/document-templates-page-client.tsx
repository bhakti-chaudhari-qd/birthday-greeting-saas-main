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
        setError(body.error?.message ?? "Could not load document templates.");
        return;
      }
      setTemplates(body.data as DocumentTemplate[]);
    } catch {
      setError(
        "Could not load document templates. Check your connection and try again.",
      );
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
      setError("Choose a PDF file to upload.");
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
        setError(body.error?.message ?? "Could not upload PDF template.");
        return;
      }

      setUploadForm(emptyUploadForm);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await loadTemplates();
    } catch {
      setError("Could not upload PDF template. Check your connection and try again.");
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
        setError(body.error?.message ?? "Could not rename template.");
        return;
      }
      cancelEdit();
      await loadTemplates();
    } catch {
      setError("Could not rename template. Check your connection and try again.");
    }
  }

  async function handleDelete(template: DocumentTemplate) {
    const confirmed = window.confirm(
      `Delete "${template.name}"? This cannot be undone.`,
    );
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
        setError(body.error?.message ?? "Could not delete template.");
        return;
      }
      await loadTemplates();
    } catch {
      setError("Could not delete template. Check your connection and try again.");
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
            <span className="font-medium text-stone-800">Name</span>
            <input
              className={`${inputClass} mt-1`}
              value={uploadForm.name}
              onChange={(event) =>
                setUploadForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Birthday Card"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">Occasion (optional)</span>
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
              <option value="">None</option>
              {occasions.map((occasion) => (
                <option key={occasion.id} value={occasion.id}>
                  {occasion.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">PDF file</span>
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
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </Panel>

      <Panel>
        {loading ? (
          <p className="p-6 text-sm text-stone-600">Loading document templates...</p>
        ) : templates.length === 0 ? (
          <p className="p-6 text-sm text-stone-600">
            No document templates yet. Upload a PDF above to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Occasion</th>
                  <th className="px-4 py-2.5 font-medium">File</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">
                    <span className="sr-only">Actions</span>
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
                      {template.occasionName ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-stone-600">
                      {template.fileName} ({formatBytes(template.byteLength)})
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={template.isActive ? "Active" : "Inactive"}
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
                              Save
                            </button>
                            <button
                              type="button"
                              className={compactSecondaryButtonClass}
                              onClick={cancelEdit}
                            >
                              Cancel
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
                              Preview
                            </a>
                            <a
                              href={`/dashboard/document-templates/${template.id}/edit`}
                              className={compactSecondaryButtonClass}
                            >
                              Edit Layout
                            </a>
                            <button
                              type="button"
                              className={compactSecondaryButtonClass}
                              onClick={() => startEdit(template)}
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              className={compactSecondaryButtonClass}
                              onClick={() => void handleDelete(template)}
                            >
                              Delete
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
  return (
    <PageShell>
      <PageHeader
        title="Document Templates"
        description="Upload a base PDF design, lay out text and variables in the editor, then generate personalized PDFs."
        actions={
          <SecondaryButtonLink href="/dashboard/generated-documents">
            Generated Documents
          </SecondaryButtonLink>
        }
      />
      <DocumentTemplatesManager />
    </PageShell>
  );
}
