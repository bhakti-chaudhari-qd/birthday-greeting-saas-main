"use client";

import { useEffect, useState } from "react";

import { InlineAlert, StatusBadge } from "@/components/ui/feedback";
import {
  PageHeader,
  PageShell,
  Panel,
  compactSecondaryButtonClass,
} from "@/components/ui/page";

type GeneratedDocument = {
  id: string;
  fileName: string;
  fileSize: number;
  templateId: string | null;
  templateName: string | null;
  createdAt: string;
  expiresAt: string;
  status: "ACTIVE" | "EXPIRED";
  fileUrl: string;
};

function formatBytes(byteLength: number): string {
  if (byteLength < 1024) {
    return `${byteLength} B`;
  }
  return `${(byteLength / 1024).toFixed(1)} KB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function GeneratedDocumentsPageClient() {
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadDocuments() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/generated-documents");
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? "Could not load generated documents.");
        return;
      }
      setDocuments(body.data as GeneratedDocument[]);
      setCanManage(Boolean(body.meta?.canManage));
    } catch {
      setError(
        "Could not load generated documents. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadInitialDocuments() {
      await loadDocuments();
    }
    void loadInitialDocuments();
  }, []);

  async function handleDelete(document: GeneratedDocument) {
    const confirmed = window.confirm(
      `Delete "${document.fileName}"? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingId(document.id);
    setError(null);
    try {
      const response = await fetch(`/api/v1/generated-documents/${document.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error?.message ?? "Could not delete document.");
        return;
      }
      await loadDocuments();
    } catch {
      setError("Could not delete document. Check your connection and try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Generated Documents"
        description="Personalized PDFs generated from your document templates. Kept for 7 days, then removed."
      />

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <Panel>
        {loading ? (
          <p className="p-6 text-sm text-stone-600">Loading generated documents...</p>
        ) : documents.length === 0 ? (
          <p className="p-6 text-sm text-stone-600">
            No generated documents yet. Generate one from a document template&apos;s
            editor.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                <tr>
                  <th className="px-4 py-2.5 font-medium">File</th>
                  <th className="px-4 py-2.5 font-medium">Template</th>
                  <th className="px-4 py-2.5 font-medium">Generated</th>
                  <th className="px-4 py-2.5 font-medium">Expires</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => {
                  const expired = document.status === "EXPIRED";
                  return (
                    <tr key={document.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-stone-900">
                        {document.fileName}
                        <span className="ml-1.5 text-xs font-normal text-stone-500">
                          ({formatBytes(document.fileSize)})
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-stone-600">
                        {document.templateName ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-stone-600">
                        {formatDate(document.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 text-stone-600">
                        {formatDate(document.expiresAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge
                          label={expired ? "Expired" : "Active"}
                          tone={expired ? "neutral" : "success"}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-2">
                          {expired ? null : (
                            <>
                              <a
                                href={document.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={compactSecondaryButtonClass}
                              >
                                View
                              </a>
                              <a
                                href={`${document.fileUrl}?download=1`}
                                className={compactSecondaryButtonClass}
                              >
                                Download
                              </a>
                            </>
                          )}
                          {canManage ? (
                            <button
                              type="button"
                              className={compactSecondaryButtonClass}
                              disabled={deletingId === document.id}
                              onClick={() => void handleDelete(document)}
                            >
                              {deletingId === document.id ? "Deleting..." : "Delete"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </PageShell>
  );
}
