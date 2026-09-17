"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CsvImportDialog,
  type ImportFieldMapping,
} from "@/components/contacts/csv-import-dialog";
import { useOccasions } from "@/components/occasions/use-occasions";
import { EmptyState, InlineAlert, StatusBadge } from "@/components/ui/feedback";
import {
  PageHeader,
  PageShell,
  Panel,
  PrimaryButtonLink,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/page";
import { formatNearestOccasion } from "@/lib/contacts/nearest-occasion";
import { fetchOrganizationCategories } from "@/lib/client/organization-reference-data";
import {
  getContactsDict,
  type ContactsDict,
} from "@/lib/i18n/dictionaries/contacts";
import { translateOccasionName } from "@/lib/i18n/occasion-labels";
import { useLocale } from "@/lib/i18n/use-locale";

/** Narrower than the shared compact button - the table's Edit action shouldn't dominate its row. */
const editButtonClass =
  "inline-flex items-center justify-center whitespace-nowrap rounded-full border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-medium text-stone-800 outline-none transition-colors hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

type OrgCategory = {
  id: string;
  name: string;
};

type Contact = {
  id: string;
  name: string;
  mobile: string;
  occasionDateDetails: Array<{
    occasionId: string;
    occasionName: string;
    date: string;
    month: number;
    day: number;
  }>;
  categoryId: string | null;
  categoryName: string | null;
  address: string | null;
  isActive: boolean;
};

type ContactsResponse = {
  data: Contact[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type ImportSummary = {
  created: number;
  updated: number;
  skippedDuplicate: number;
  skippedLimit: number;
  invalid: number;
  errors: Array<{ row: number; message: string }>;
};

type ImportJobStatus = {
  id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  fileName: string;
  totalRows: number;
  processedRows: number;
  created: number;
  updated: number;
  skippedDuplicate: number;
  skippedLimit: number;
  invalid: number;
  errorMessage?: string | null;
};

function formatImportSummaryNotice(
  summary: {
    created: number;
    updated: number;
    skippedDuplicate: number;
    skippedLimit: number;
    invalid: number;
  },
  dict: ContactsDict,
) {
  return dict.messages.importFinishedSummary(summary);
}

export type ContactsPageClientProps = {
  /** Organization Owners can export; Staff cannot (API is ADMIN-only). */
  canExport: boolean;
};

const SEARCH_DEBOUNCE_MS = 300;
const HIGHLIGHT_DURATION_MS = 4000;

/** Ready to send to the API: 2+ chars for name, 3+ digits for mobile-like input. */
function getSearchQueryForApi(raw: string): string | null {
  const term = raw.trim();
  if (!term) {
    return null;
  }

  const compact = term.replace(/[\s+()-]/g, "");
  const digits = term.replace(/\D/g, "");
  const digitHeavy =
    digits.length > 0 && digits.length >= Math.ceil(compact.length * 0.8);

  if (digitHeavy) {
    return digits.length >= 3 ? term : null;
  }

  return term.length >= 2 ? term : null;
}

function searchHint(raw: string, dict: ContactsDict): string | null {
  const term = raw.trim();
  if (!term) {
    return null;
  }
  if (getSearchQueryForApi(term)) {
    return null;
  }

  const digits = term.replace(/\D/g, "");
  const compact = term.replace(/[\s+()-]/g, "");
  const digitHeavy =
    digits.length > 0 && digits.length >= Math.ceil(compact.length * 0.8);

  return digitHeavy ? dict.filters.hintMobile : dict.filters.hintText;
}

function ContactsLoadingSkeleton() {
  const dict = getContactsDict(useLocale());
  return (
    <div className="animate-pulse" role="status" aria-label={dict.loadingAria}>
      <span className="sr-only">{dict.loadingAria}</span>
      <div className="hidden border-b border-stone-200 bg-stone-50 px-4 py-3 md:grid md:grid-cols-[2rem_1.5fr_1fr_1fr_1fr_1fr_4rem] md:gap-4">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="h-3 rounded bg-stone-200" />
        ))}
      </div>
      {Array.from({ length: 6 }, (_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid grid-cols-[2rem_1fr_1fr_4rem] gap-4 border-b border-stone-100 px-4 py-4 last:border-0 md:grid-cols-[2rem_1.5fr_1fr_1fr_1fr_1fr_4rem]"
        >
          <div className="h-4 w-4 rounded bg-stone-200" />
          <div className="h-4 rounded bg-stone-200" />
          <div className="hidden h-4 rounded bg-stone-200 md:block" />
          <div className="h-4 rounded bg-stone-200" />
          <div className="hidden h-4 rounded bg-stone-200 sm:block" />
          <div className="hidden h-4 rounded bg-stone-200 md:block" />
          <div className="h-8 rounded-full bg-stone-200" />
        </div>
      ))}
    </div>
  );
}

async function fetchContactCategories(): Promise<OrgCategory[]> {
  return fetchOrganizationCategories();
}

export function ContactsPageClient({
  canExport,
}: ContactsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const dict = getContactsDict(locale);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [meta, setMeta] = useState<ContactsResponse["meta"] | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isActive, setIsActive] = useState<"all" | "true" | "false">("true");
  const [categoryId, setCategoryId] = useState("all");
  const [occasionId, setOccasionId] = useState("all");
  const { occasions } = useOccasions();
  const [categories, setCategories] = useState<OrgCategory[]>([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importJob, setImportJob] = useState<ImportJobStatus | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(
    null,
  );
  const [importNotice, setImportNotice] = useState<string | null>(null);

  useEffect(() => {
    function applyHighlightFromUrl() {
      const highlight = searchParams.get("highlight");
      if (!highlight) {
        return null;
      }
      setHighlightedId(highlight);
      router.replace("/dashboard/contacts", { scroll: false });
      return window.setTimeout(() => {
        setHighlightedId(null);
      }, HIGHLIGHT_DURATION_MS);
    }

    const timer = applyHighlightFromUrl();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const apiSearch = useMemo(
    () => getSearchQueryForApi(debouncedSearch),
    [debouncedSearch],
  );
  const hint = searchHint(searchInput, dict);

  const pollImportJob = useCallback(async (jobId: string) => {
    const response = await fetch(`/api/v1/contacts/import/jobs/${jobId}`);
    const body = await response.json();
    if (!response.ok) {
      return null;
    }
    return body.data as ImportJobStatus;
  }, []);

  async function finishImportJob(job: ImportJobStatus) {
    const errorsResponse = await fetch(
      `/api/v1/contacts/import/jobs/${job.id}/errors?limit=100`,
    );
    const errorsBody = await errorsResponse.json();
    const errors = errorsResponse.ok
      ? (errorsBody.data as Array<{ row: number; message: string }>)
      : [];

    const summary: ImportSummary = {
      created: job.created,
      updated: job.updated ?? 0,
      skippedDuplicate: job.skippedDuplicate,
      skippedLimit: job.skippedLimit,
      invalid: job.invalid,
      errors,
    };

    setImportSummary(summary);
    setImportNotice(formatImportSummaryNotice(summary, dict));
    setImportJob(null);
    setPage(1);
    setSelectedIds(new Set());
    setReloadToken((current) => current + 1);
    setCategories(await fetchContactCategories());
  }

  useEffect(() => {
    let cancelled = false;

    async function loadActiveJob() {
      try {
        const response = await fetch("/api/v1/contacts/import/jobs/active");
        const body = await response.json();
        if (!response.ok || cancelled) {
          return;
        }
        if (body.data) {
          setImportJob(body.data as ImportJobStatus);
          setImporting(true);
        }
      } catch {
        // ignore
      }
    }

    void loadActiveJob();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      !importJob ||
      importJob.status === "COMPLETED" ||
      importJob.status === "FAILED" ||
      importJob.status === "CANCELLED"
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      void (async () => {
        const latest = await pollImportJob(importJob.id);
        if (!latest) {
          return;
        }

        setImportJob(latest);

        if (
          latest.status === "COMPLETED" ||
          latest.status === "FAILED" ||
          latest.status === "CANCELLED"
        ) {
          setImporting(false);
          if (latest.status === "COMPLETED") {
            await finishImportJob(latest);
          } else if (latest.status === "FAILED") {
            setError(latest.errorMessage ?? dict.messages.importFailed);
            setImportJob(null);
          } else {
            setImportJob(null);
          }
        }
      })();
    }, 2000);

    return () => window.clearInterval(timer);
    // finishImportJob is a plain function (recreated every render, closes over
    // current dict/state) - intentionally excluded so this interval isn't
    // torn down and rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importJob, pollImportJob]);

  useEffect(() => {
    async function loadCategories() {
      try {
        setCategories(await fetchContactCategories());
      } catch {
        // Filter still works without options.
      }
    }
    void loadCategories();
  }, [reloadToken]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadContacts() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
        isActive,
      });

      if (apiSearch) {
        params.set("search", apiSearch);
      }
      if (categoryId !== "all") {
        params.set("categoryId", categoryId);
      }
      if (occasionId !== "all") {
        params.set("occasionId", occasionId);
      }

      try {
        const response = await fetch(`/api/v1/contacts?${params.toString()}`, {
          signal: controller.signal,
        });
        const body = await response.json();

        if (!response.ok) {
          setError(body.error?.message ?? dict.messages.couldNotLoadContacts);
          return;
        }

        setContacts(body.data);
        setMeta(body.meta);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setError(dict.messages.couldNotLoadContactsConn);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadContacts();
    return () => {
      controller.abort();
    };
  }, [page, apiSearch, isActive, categoryId, occasionId, reloadToken]);

  const pageIds = useMemo(() => contacts.map((c) => c.id), [contacts]);
  const selectedOnPage = pageIds.filter((id) => selectedIds.has(id));
  const allOnPageSelected =
    pageIds.length > 0 && selectedOnPage.length === pageIds.length;
  const someOnPageSelected =
    selectedOnPage.length > 0 && selectedOnPage.length < pageIds.length;

  function toggleSelectAllOnPage() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allOnPageSelected) {
        for (const id of pageIds) {
          next.delete(id);
        }
      } else {
        for (const id of pageIds) {
          next.add(id);
        }
      }
      return next;
    });
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleBulkStatus(nextActive: boolean) {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      return;
    }

    const action = nextActive ? "activate" : "deactivate";
    if (!window.confirm(dict.bulk.confirmBulkStatus(nextActive, ids.length))) {
      return;
    }

    setBulkUpdating(true);
    setError(null);
    setBulkMessage(null);

    try {
      const response = await fetch("/api/v1/contacts/bulk-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, isActive: nextActive }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? dict.messages.couldNotChangeStatus(action));
        return;
      }

      const updated = Number(body.data?.updated ?? 0);
      setBulkMessage(
        updated === 0
          ? dict.messages.noStatusChangeNeeded
          : dict.messages.updatedContacts(updated),
      );
      setSelectedIds(new Set());
      setReloadToken((token) => token + 1);
    } catch {
      setError(dict.messages.couldNotUpdateConn);
    } finally {
      setBulkUpdating(false);
    }
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      return;
    }

    if (!window.confirm(dict.bulk.confirmBulkDelete(ids.length))) {
      return;
    }

    setBulkUpdating(true);
    setError(null);
    setBulkMessage(null);

    try {
      const response = await fetch("/api/v1/contacts/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? dict.messages.couldNotDeleteContacts);
        return;
      }

      const deleted = Number(body.data?.deleted ?? 0);
      setBulkMessage(dict.messages.deletedContacts(deleted));
      setSelectedIds(new Set());
      setReloadToken((token) => token + 1);
    } catch {
      setError(dict.messages.couldNotDeleteConn);
    } finally {
      setBulkUpdating(false);
    }
  }

  async function handleBulkExport() {
    const ids = [...selectedIds];
    if (ids.length === 0 || !canExport) {
      return;
    }

    setBulkUpdating(true);
    setError(null);
    setBulkMessage(null);

    try {
      const response = await fetch("/api/v1/contacts/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? dict.messages.couldNotExportSelected);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "contacts-selected.csv";
      anchor.click();
      URL.revokeObjectURL(url);
      setBulkMessage(dict.messages.exportedSelected(ids.length));
    } catch {
      setError(dict.messages.couldNotExportConn);
    } finally {
      setBulkUpdating(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError(null);

    const params = new URLSearchParams({ isActive });
    if (apiSearch) {
      params.set("search", apiSearch);
    }
    if (categoryId !== "all") {
      params.set("categoryId", categoryId);
    }
    if (occasionId !== "all") {
      params.set("occasionId", occasionId);
    }

    try {
      const response = await fetch(
        `/api/v1/contacts/export?${params.toString()}`,
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? dict.messages.couldNotExportContacts);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "contacts.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(dict.messages.couldNotExportConn);
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(
    file: File,
    fieldMappings: ImportFieldMapping[] = [],
  ) {
    setImporting(true);
    setError(null);
    setImportSummary(null);
    setImportNotice(null);
    setImportJob(null);

    let startedAsyncJob = false;

    try {
      const lowerName = file.name.toLowerCase();
      const isExcelByName =
        lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls");
      const isCsvByName = lowerName.endsWith(".csv");
      const isExcelByMime =
        !isCsvByName &&
        (file.type ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
          file.type === "application/vnd.ms-excel");
      const isExcel = isExcelByName || isExcelByMime;

      let payload: {
        csv?: string;
        excelBase64?: string;
        fileName?: string;
        fieldMappings?: ImportFieldMapping[];
      };

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        payload = { excelBase64: btoa(binary), fileName: file.name };
      } else if (
        isCsvByName ||
        file.type === "text/csv" ||
        file.type === "text/plain" ||
        file.type === ""
      ) {
        payload = { csv: await file.text(), fileName: file.name };
      } else {
        setError(dict.messages.importFileTypeError);
        return;
      }
      payload.fieldMappings = fieldMappings;

      const response = await fetch("/api/v1/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? dict.messages.couldNotImportContacts);
        return;
      }

      if (body.mode === "sync") {
        const summary = body.data as ImportSummary;
        setImportSummary(summary);
        setImportNotice(
          formatImportSummaryNotice(
            {
              created: summary.created,
              updated: summary.updated ?? 0,
              skippedDuplicate: summary.skippedDuplicate,
              skippedLimit: summary.skippedLimit,
              invalid: summary.invalid,
            },
            dict,
          ),
        );
        setPage(1);
        setSelectedIds(new Set());
        setReloadToken((current) => current + 1);
        setCategories(await fetchContactCategories());
        return;
      }

      const job = body.data.job as ImportJobStatus;
      startedAsyncJob = true;
      setImportJob(job);
      setImportNotice(dict.messages.importStarted);
    } catch {
      setError(dict.messages.couldNotImportConn);
    } finally {
      if (!startedAsyncJob) {
        setImporting(false);
      }
    }
  }

  const hasFilters =
    Boolean(apiSearch) ||
    isActive !== "true" ||
    categoryId !== "all" ||
    occasionId !== "all";
  const selectedCount = selectedIds.size;

  return (
    <PageShell>
      <PageHeader
        title={dict.header.title}
        description={dict.header.description}
        actions={
          <>
            {canExport ? (
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={exporting}
                className={secondaryButtonClass}
              >
                {exporting ? dict.header.exporting : dict.header.exportCsv}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setImportDialogOpen(true)}
              disabled={importing}
              className={secondaryButtonClass}
            >
              {importing ? dict.header.importing : dict.header.importCsv}
            </button>
            <PrimaryButtonLink href="/dashboard/contacts/new">
              {dict.header.addContact}
            </PrimaryButtonLink>
          </>
        }
      />

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {bulkMessage ? (
        <InlineAlert tone="success">{bulkMessage}</InlineAlert>
      ) : null}
      {importNotice ? (
        <InlineAlert tone="success">{importNotice}</InlineAlert>
      ) : null}

      {importJob &&
      (importJob.status === "PENDING" || importJob.status === "PROCESSING") ? (
        <Panel className="p-4">
          <p className="text-sm font-medium text-stone-900">
            {dict.importProgress.importingFile(importJob.fileName)}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            {importJob.totalRows > 0
              ? dict.importProgress.rowsProcessed(
                  importJob.processedRows.toLocaleString("en-IN"),
                  importJob.totalRows.toLocaleString("en-IN"),
                )
              : dict.importProgress.preparingFile}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{
                width:
                  importJob.totalRows > 0
                    ? `${Math.min(100, Math.round((importJob.processedRows / importJob.totalRows) * 100))}%`
                    : "8%",
              }}
            />
          </div>
          <p className="mt-2 text-xs text-stone-500">
            {dict.importProgress.addedUpdatedSoFar(
              (importJob.created ?? 0).toLocaleString("en-IN"),
              (importJob.updated ?? 0).toLocaleString("en-IN"),
            )}
          </p>
        </Panel>
      ) : null}

      {importSummary && importSummary.errors.length > 0 ? (
        <Panel className="p-4">
          <p className="text-sm font-medium text-stone-900">
            {dict.importDetails.heading(importSummary.errors.length)}
          </p>
          <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-stone-600">
            {importSummary.errors.slice(0, 20).map((item) => (
              <li key={`${item.row}-${item.message}`}>
                {dict.importDetails.rowError(item.row, item.message)}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="block min-w-0 flex-1 text-sm">
            <span className="sr-only">{dict.filters.searchContacts}</span>
            <input
              className={inputClass}
              placeholder={dict.filters.searchPlaceholder}
              value={searchInput}
              onChange={(event) => {
                setPage(1);
                setSearchInput(event.target.value);
              }}
            />
          </label>
          <label className="block text-sm sm:w-44">
            <span className="sr-only">{dict.filters.categoryFilter}</span>
            <select
              className={inputClass}
              value={categoryId}
              onChange={(event) => {
                setPage(1);
                setCategoryId(event.target.value);
              }}
            >
              <option value="all">{dict.filters.allCategories}</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:w-44">
            <span className="sr-only">{dict.filters.occasionFilter}</span>
            <select
              className={inputClass}
              value={occasionId}
              onChange={(event) => {
                setPage(1);
                setOccasionId(event.target.value);
              }}
            >
              <option value="all">{dict.filters.allOccasions}</option>
              {occasions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:w-44">
            <span className="sr-only">{dict.filters.statusFilter}</span>
            <select
              className={inputClass}
              value={isActive}
              onChange={(event) => {
                setPage(1);
                setIsActive(event.target.value as "all" | "true" | "false");
              }}
            >
              <option value="true">{dict.filters.active}</option>
              <option value="false">{dict.filters.inactive}</option>
              <option value="all">{dict.filters.allStatuses}</option>
            </select>
          </label>
        </div>
        {hint ? (
          <p className="mt-2 text-xs text-stone-500">{hint}</p>
        ) : null}
      </Panel>

      {selectedCount > 0 ? (
        <Panel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stone-700">{dict.bulk.selected(selectedCount)}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => void handleBulkStatus(true)}
              className={primaryButtonClass}
            >
              {bulkUpdating ? dict.bulk.updating : dict.bulk.markActive}
            </button>
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => void handleBulkStatus(false)}
              className={secondaryButtonClass}
            >
              {dict.bulk.markInactive}
            </button>
            {canExport ? (
              <button
                type="button"
                disabled={bulkUpdating}
                onClick={() => void handleBulkExport()}
                className={secondaryButtonClass}
              >
                {dict.bulk.exportSelected}
              </button>
            ) : null}
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => void handleBulkDelete()}
              className={secondaryButtonClass}
            >
              {dict.bulk.delete}
            </button>
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => setSelectedIds(new Set())}
              className={secondaryButtonClass}
            >
              {dict.bulk.clearSelection}
            </button>
          </div>
        </Panel>
      ) : null}

      <Panel>
        {loading ? (
          <ContactsLoadingSkeleton />
        ) : contacts.length === 0 ? (
          <EmptyState
            title={
              hasFilters
                ? dict.emptyState.noMatchingTitle
                : dict.emptyState.noContactsTitle
            }
            description={
              hasFilters
                ? dict.emptyState.tryDifferentSearch
                : dict.emptyState.startByAdding
            }
            actionHref={hasFilters ? undefined : "/dashboard/contacts/new"}
            actionLabel={hasFilters ? undefined : dict.emptyState.addContactAction}
            secondaryLabel={hasFilters ? undefined : dict.header.importCsv}
            secondaryOnClick={
              hasFilters ? undefined : () => setImportDialogOpen(true)
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                <tr>
                  <th className="w-10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-stone-300"
                      checked={allOnPageSelected}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate = someOnPageSelected;
                        }
                      }}
                      onChange={toggleSelectAllOnPage}
                      aria-label={dict.table.selectAllAria}
                    />
                  </th>
                  <th className="px-4 py-2.5 font-medium">{dict.table.colName}</th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">
                    {dict.table.colCategory}
                  </th>
                  <th className="px-4 py-2.5 font-medium">{dict.table.colPhone}</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">
                    {dict.table.colNextOccasion}
                  </th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">
                    {dict.table.colStatus}
                  </th>
                  <th className="px-4 py-2.5 font-medium">
                    <span className="sr-only">{dict.table.colActionsSr}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className={`border-b border-stone-100 transition-colors duration-1000 last:border-0 ${
                      contact.id === highlightedId ? "bg-emerald-50" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-stone-300"
                        checked={selectedIds.has(contact.id)}
                        onChange={() => toggleSelectOne(contact.id)}
                        aria-label={dict.table.selectOneAria(contact.name)}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-stone-900">
                        {contact.name}
                      </div>
                    </td>
                    <td className="hidden px-4 py-2.5 text-stone-600 md:table-cell">
                      {contact.categoryName ?? dict.table.emptyDash}
                    </td>
                    <td className="px-4 py-2.5 text-stone-700">
                      {contact.mobile}
                    </td>
                    <td className="hidden px-4 py-2.5 text-stone-600 sm:table-cell">
                      {formatNearestOccasion(
                        contact.occasionDateDetails.map((detail) => ({
                          name: translateOccasionName(detail.occasionName, locale),
                          month: detail.month,
                          day: detail.day,
                        })),
                      )}
                    </td>
                    <td className="hidden px-4 py-2.5 md:table-cell">
                      <StatusBadge
                        label={contact.isActive ? dict.table.active : dict.table.inactive}
                        tone={contact.isActive ? "success" : "neutral"}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/contacts/${contact.id}/edit`}
                          className={editButtonClass}
                        >
                          {dict.table.edit}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {meta && meta.totalPages > 1 ? (
        <div className="flex flex-col gap-3 text-sm text-stone-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {dict.pagination.pageOf(meta.page, meta.totalPages, meta.total)}
            {selectedCount > 0
              ? dict.pagination.selectedAcrossPages(selectedCount)
              : ""}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className={secondaryButtonClass}
            >
              {dict.pagination.previous}
            </button>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className={secondaryButtonClass}
            >
              {dict.pagination.next}
            </button>
          </div>
        </div>
      ) : null}

      <CsvImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onStartImport={(file, mappings) => void handleImportFile(file, mappings)}
      />
    </PageShell>
  );
}
