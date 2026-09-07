"use client";

import { useEffect, useState } from "react";

import { InlineAlert, StatusBadge } from "@/components/ui/feedback";
import {
  PageHeader,
  PageShell,
  Panel,
  compactSecondaryButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/page";

type ContactField = {
  id: string;
  key: string;
  label: string;
  type: string;
  sortOrder: number;
  isActive: boolean;
};

const emptyForm = { label: "", key: "" };

export function ContactFieldsPageClient() {
  const [fields, setFields] = useState<ContactField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<ContactField | null>(null);

  async function loadFields() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/contact-fields");
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? "Could not load contact fields.");
        return;
      }
      setFields(body.data as ContactField[]);
    } catch {
      setError("Could not load contact fields. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadInitialFields() {
      await loadFields();
    }
    void loadInitialFields();
  }, []);

  function startEdit(field: ContactField) {
    setEditing(field);
    setForm({ label: field.label, key: field.key });
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
  }

  async function saveField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        editing ? `/api/v1/contact-fields/${editing.id}` : "/api/v1/contact-fields",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editing
              ? { label: form.label }
              : { label: form.label, key: form.key || undefined, type: "TEXT" },
          ),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? "Could not save contact field.");
        return;
      }
      resetForm();
      await loadFields();
    } catch {
      setError("Could not save contact field. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleField(field: ContactField) {
    setError(null);
    try {
      const response = await fetch(`/api/v1/contact-fields/${field.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !field.isActive }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? "Could not update contact field.");
        return;
      }
      await loadFields();
    } catch {
      setError("Could not update contact field. Check your connection and try again.");
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Contact Fields"
        description="Manage reusable contact attributes for imports, exports, and template variables."
      />

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <Panel className="p-4">
        <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={saveField}>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">Label</span>
            <input
              className={`${inputClass} mt-1`}
              value={form.label}
              onChange={(event) =>
                setForm((current) => ({ ...current, label: event.target.value }))
              }
              placeholder="Designation"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-stone-800">Key</span>
            <input
              className={`${inputClass} mt-1`}
              value={form.key}
              onChange={(event) =>
                setForm((current) => ({ ...current, key: event.target.value }))
              }
              placeholder="designation"
              disabled={Boolean(editing)}
            />
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className={primaryButtonClass} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save" : "Add Field"}
            </button>
            {editing ? (
              <button type="button" className={secondaryButtonClass} onClick={resetForm}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </Panel>

      <Panel>
        {loading ? (
          <p className="p-6 text-sm text-stone-600">Loading contact fields...</p>
        ) : fields.length === 0 ? (
          <p className="p-6 text-sm text-stone-600">
            No contact fields yet. Add one to make it available in contacts,
            imports, exports, and templates.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Field</th>
                  <th className="px-4 py-2.5 font-medium">Variable</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-stone-900">
                      {field.label}
                    </td>
                    <td className="px-4 py-2.5 text-stone-600">{`{{${field.key}}}`}</td>
                    <td className="px-4 py-2.5 text-stone-600">{field.type}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={field.isActive ? "Active" : "Inactive"}
                        tone={field.isActive ? "success" : "neutral"}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className={compactSecondaryButtonClass}
                          onClick={() => startEdit(field)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={compactSecondaryButtonClass}
                          onClick={() => void toggleField(field)}
                        >
                          {field.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </PageShell>
  );
}
