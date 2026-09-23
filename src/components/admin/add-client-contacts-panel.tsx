"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/page";

type AddContactFormState = {
  name: string;
  mobile: string;
  email: string;
  birthday: string;
  categoryName: string;
};

const emptyForm: AddContactFormState = {
  name: "",
  mobile: "",
  email: "",
  birthday: "",
  categoryName: "",
};

type ImportSummary = {
  created: number;
  updated: number;
  skippedDuplicate: number;
  skippedLimit: number;
  invalid: number;
};

function isExcelFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".csv")) {
    return false;
  }
  return (
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"
  );
}

export function AddClientContactsPanel({
  organizationId,
}: {
  organizationId: string;
}) {
  const router = useRouter();

  const [form, setForm] = useState<AddContactFormState>(emptyForm);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  async function handleAddContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdding(true);
    setAddError(null);
    setAddSuccess(null);

    try {
      const response = await fetch(
        `/api/v1/admin/organizations/${organizationId}/contacts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            mobile: form.mobile.trim(),
            email: form.email.trim() || undefined,
            birthday: form.birthday.trim() || undefined,
            categoryName: form.categoryName.trim() || undefined,
          }),
        },
      );
      const body = await response.json();

      if (!response.ok) {
        setAddError(body.error?.message ?? "Failed to add contact");
        return;
      }

      setAddSuccess(`Added ${body.data.name}.`);
      setForm(emptyForm);
      router.refresh();
    } catch {
      setAddError("Failed to add contact");
    } finally {
      setAdding(false);
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportError(null);
    setImportSummary(null);

    try {
      const isExcel = isExcelFile(file);
      let payload: { csv?: string; excelBase64?: string; fileName?: string };

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        payload = { excelBase64: btoa(binary), fileName: file.name };
      } else {
        payload = { csv: await file.text(), fileName: file.name };
      }

      const response = await fetch(
        `/api/v1/admin/organizations/${organizationId}/contacts/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json();

      if (!response.ok) {
        setImportError(body.error?.message ?? "Failed to import contacts");
        return;
      }

      setImportSummary(body.data as ImportSummary);
      router.refresh();
    } catch {
      setImportError("Failed to import contacts");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-semibold text-stone-900">Add a contact</h3>
        <p className="mt-1 text-xs text-stone-500">
          Adds a contact directly into this client&rsquo;s account, the same
          as if they added it themselves. Useful when onboarding a client who
          has handed you their contact list.
        </p>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          onSubmit={handleAddContact}
        >
          <label className="block text-sm">
            <span className="font-medium text-stone-800">Name</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">Mobile</span>
            <input
              className={`mt-1 ${inputClass}`}
              value={form.mobile}
              placeholder="10-digit mobile number"
              onChange={(event) =>
                setForm((current) => ({ ...current, mobile: event.target.value }))
              }
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">
              Birthday (optional)
            </span>
            <input
              type="date"
              className={`mt-1 ${inputClass}`}
              value={form.birthday}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  birthday: event.target.value,
                }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">
              Email (optional)
            </span>
            <input
              type="email"
              className={`mt-1 ${inputClass}`}
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-stone-800">
              Category (optional)
            </span>
            <input
              className={`mt-1 ${inputClass}`}
              value={form.categoryName}
              placeholder="e.g. Friend, Relative, Client"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  categoryName: event.target.value,
                }))
              }
            />
            <span className="mt-0.5 block text-xs text-stone-500">
              Creates the category for this client if it doesn&rsquo;t
              already exist.
            </span>
          </label>

          {addError ? <InlineAlert tone="error">{addError}</InlineAlert> : null}
          {addSuccess ? (
            <InlineAlert tone="success">{addSuccess}</InlineAlert>
          ) : null}

          <div className="sm:col-span-2">
            <button type="submit" disabled={adding} className={primaryButtonClass}>
              {adding ? "Adding…" : "Add contact"}
            </button>
          </div>
        </form>
      </div>

      <div className="border-t border-stone-200 pt-4">
        <h3 className="text-sm font-semibold text-stone-900">
          Import contacts (CSV/Excel)
        </h3>
        <p className="mt-1 text-xs text-stone-500">
          Columns: Name, Mobile, Email, Birthday, Category (matches this
          client&rsquo;s existing custom fields and occasions automatically).
          For files with thousands of rows, prefer the client&rsquo;s own
          dashboard, which processes large imports in the background.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            disabled={importing}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleImportFile(file);
              }
            }}
            className="text-sm text-stone-700"
          />
          {importing ? (
            <span className={secondaryButtonClass}>Importing…</span>
          ) : null}
        </div>

        {importError ? (
          <div className="mt-3">
            <InlineAlert tone="error">{importError}</InlineAlert>
          </div>
        ) : null}

        {importSummary ? (
          <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
            {importSummary.created} added · {importSummary.updated} updated ·{" "}
            {importSummary.skippedDuplicate} duplicate ·{" "}
            {importSummary.skippedLimit} skipped (limit) ·{" "}
            {importSummary.invalid} invalid
          </div>
        ) : null}
      </div>
    </div>
  );
}
