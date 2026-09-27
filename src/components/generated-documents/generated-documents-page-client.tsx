"use client";

import { useCallback, useEffect, useState } from "react";

import { InlineAlert, StatusBadge } from "@/components/ui/feedback";
import {
  PageHeader,
  PageShell,
  Panel,
  compactSecondaryButtonClass,
} from "@/components/ui/page";
import { getDeliveriesDict } from "@/lib/i18n/dictionaries/deliveries";
import { useLocale } from "@/lib/i18n/use-locale";

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
  const dict = getDeliveriesDict(useLocale()).generatedDocuments;
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/generated-documents");
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? dict.errors.couldNotLoad);
        return;
      }
      setDocuments(body.data as GeneratedDocument[]);
      setCanManage(Boolean(body.meta?.canManage));
    } catch {
      setError(dict.errors.couldNotLoadRetry);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadInitialDocuments() {
      await loadDocuments();
    }
    void loadInitialDocuments();
  }, [loadDocuments]);

  async function handleDelete(document: GeneratedDocument) {
    const confirmed = window.confirm(dict.confirmDelete(document.fileName));
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
        setError(body.error?.message ?? dict.errors.couldNotDelete);
        return;
      }
      await loadDocuments();
    } catch {
      setError(dict.errors.couldNotDeleteRetry);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title={dict.pageTitle}
        description={dict.pageDescription}
      />

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <Panel>
        {loading ? (
          <p className="p-6 text-sm text-stone-600">{dict.loading}</p>
        ) : documents.length === 0 ? (
          <p className="p-6 text-sm text-stone-600">{dict.emptyState}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{dict.table.file}</th>
                  <th className="px-4 py-2.5 font-medium">{dict.table.template}</th>
                  <th className="px-4 py-2.5 font-medium">{dict.table.generated}</th>
                  <th className="px-4 py-2.5 font-medium">{dict.table.expires}</th>
                  <th className="px-4 py-2.5 font-medium">{dict.table.status}</th>
                  <th className="px-4 py-2.5 font-medium">
                    <span className="sr-only">{dict.table.actionsSr}</span>
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
                          label={expired ? dict.statusExpired : dict.statusActive}
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
                                {dict.view}
                              </a>
                              <a
                                href={`${document.fileUrl}?download=1`}
                                className={compactSecondaryButtonClass}
                              >
                                {dict.download}
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
                              {deletingId === document.id ? dict.deleting : dict.delete}
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
