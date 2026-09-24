"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/page";
import { getAdminClientDetailDict } from "@/lib/i18n/dictionaries/admin-client-detail";
import { useLocale } from "@/lib/i18n/use-locale";

type AddContactFormState = {
  name: string;
  mobile: string;
  email: string;
  birthday: string;
  /** Existing category id, or "" for none. Mutually exclusive with newCategoryName. */
  categoryId: string;
  /** Typed to create a brand-new primary category (mutually exclusive with categoryId). */
  newCategoryName: string;
  /** Extra categories beyond the primary one - same as the client's own "additional categories". */
  categoryTagIds: string[];
};

const emptyForm: AddContactFormState = {
  name: "",
  mobile: "",
  email: "",
  birthday: "",
  categoryId: "",
  newCategoryName: "",
  categoryTagIds: [],
};

type ClientCategory = {
  id: string;
  name: string;
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
  const dict = getAdminClientDetailDict(useLocale()).contactsTab;

  const [categories, setCategories] = useState<ClientCategory[]>([]);
  const [addingNewCategory, setAddingNewCategory] = useState(false);

  const [form, setForm] = useState<AddContactFormState>(emptyForm);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch(
          `/api/v1/admin/organizations/${organizationId}/categories`,
        );
        const body = await response.json();
        if (response.ok) {
          setCategories(body.data as ClientCategory[]);
        }
      } catch {
        // Optional - the form still works with a typed-in new category name.
      }
    }

    void loadCategories();
  }, [organizationId]);

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
            ...(addingNewCategory
              ? { categoryName: form.newCategoryName.trim() || undefined }
              : { categoryId: form.categoryId || undefined }),
            categoryTagIds: form.categoryTagIds,
          }),
        },
      );
      const body = await response.json();

      if (!response.ok) {
        setAddError(body.error?.message ?? dict.failedToAdd);
        return;
      }

      setAddSuccess(dict.addedSuccess(body.data.name));
      setForm(emptyForm);
      setAddingNewCategory(false);
      if (body.data.category) {
        setCategories((current) => {
          if (current.some((category) => category.id === body.data.category.id)) {
            return current;
          }
          return [...current, body.data.category].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
        });
      }
      router.refresh();
    } catch {
      setAddError(dict.failedToAdd);
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
        setImportError(body.error?.message ?? dict.failedToImport);
        return;
      }

      setImportSummary(body.data as ImportSummary);
      router.refresh();
    } catch {
      setImportError(dict.failedToImport);
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
        <h3 className="text-sm font-semibold text-stone-900">{dict.addContact}</h3>
        <p className="mt-1 text-xs text-stone-500">
          {dict.addContactDescription}
        </p>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          onSubmit={handleAddContact}
        >
          <label className="block text-sm">
            <span className="font-medium text-stone-800">{dict.name}</span>
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
            <span className="font-medium text-stone-800">{dict.mobile}</span>
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
              {dict.birthday} {dict.optional}
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
              {dict.email} {dict.optional}
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
          <div className="block text-sm sm:col-span-2">
            <span className="font-medium text-stone-800">{dict.category}</span>
            {addingNewCategory ? (
              <div className="mt-1 flex gap-2">
                <input
                  className={inputClass}
                  value={form.newCategoryName}
                  placeholder="New category name"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      newCategoryName: event.target.value,
                    }))
                  }
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setAddingNewCategory(false);
                    setForm((current) => ({ ...current, newCategoryName: "" }));
                  }}
                  className={`${secondaryButtonClass} shrink-0 whitespace-nowrap`}
                >
                  {dict.cancel}
                </button>
              </div>
            ) : (
              <div className="mt-1 flex gap-2">
                <select
                  className={inputClass}
                  value={form.categoryId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      categoryId: event.target.value,
                      categoryTagIds: current.categoryTagIds.filter(
                        (id) => id !== event.target.value,
                      ),
                    }))
                  }
                >
                  <option value="">{dict.noCategory}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setAddingNewCategory(true)}
                  className={`${secondaryButtonClass} shrink-0 whitespace-nowrap`}
                >
                  {dict.newCategory}
                </button>
              </div>
            )}
          </div>

          {categories.length > 0 ? (
            <div className="block text-sm sm:col-span-2">
              <span className="font-medium text-stone-800">
                {dict.additionalCategories}
              </span>
              <span className="mt-0.5 block text-xs text-stone-500">
                {dict.additionalCategoriesHint}
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {categories
                  .filter((category) => category.id !== form.categoryId)
                  .map((category) => {
                    const checked = form.categoryTagIds.includes(category.id);
                    return (
                      <label
                        key={category.id}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
                          checked
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-stone-300 text-stone-700 hover:bg-stone-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              categoryTagIds: event.target.checked
                                ? [...current.categoryTagIds, category.id]
                                : current.categoryTagIds.filter(
                                    (id) => id !== category.id,
                                  ),
                            }))
                          }
                        />
                        {category.name}
                      </label>
                    );
                  })}
              </div>
            </div>
          ) : null}

          {addError ? <InlineAlert tone="error">{addError}</InlineAlert> : null}
          {addSuccess ? (
            <InlineAlert tone="success">{addSuccess}</InlineAlert>
          ) : null}

          <div className="sm:col-span-2">
            <button type="submit" disabled={adding} className={primaryButtonClass}>
              {adding ? dict.adding : dict.add}
            </button>
          </div>
        </form>
      </div>

      <div className="border-t border-stone-200 pt-4">
        <h3 className="text-sm font-semibold text-stone-900">
          {dict.importTitle}
        </h3>
        <p className="mt-1 text-xs text-stone-500">
          {dict.importDescription}
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
            <span className={secondaryButtonClass}>{dict.importing}</span>
          ) : null}
        </div>

        {importError ? (
          <div className="mt-3">
            <InlineAlert tone="error">{importError}</InlineAlert>
          </div>
        ) : null}

        {importSummary ? (
          <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
            {dict.importSummary(
              importSummary.created,
              importSummary.updated,
              importSummary.skippedDuplicate,
              importSummary.skippedLimit,
              importSummary.invalid,
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
