"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useOccasions } from "@/components/occasions/use-occasions";
import {
  SecondaryButtonLink,
  compactSecondaryButtonClass,
} from "@/components/ui/page";

type SmsTemplateSetupSummary = {
  id: string;
  name: string;
  realSmsReady: boolean;
  realSmsStatusLabel: string;
};

type TemplatesResponse = {
  data: Array<{
    id: string;
    name: string;
    channel: "SMS" | "WHATSAPP" | "EMAIL";
    realSmsReady: boolean;
    realSmsStatusLabel: string;
  }>;
};

type ApprovedTemplateForm = {
  name: string;
  occasionId: string;
  dltTemplateId: string;
  dltApprovedContent: string;
};

const emptyApprovedTemplateForm: ApprovedTemplateForm = {
  name: "",
  occasionId: "",
  dltTemplateId: "",
  dltApprovedContent: "",
};

const APPROVED_DLT_SLOT_PATTERN = /\{\{[^}]+\}\}|\{#[^#]+#\}/g;

function buildLocalTemplateFromDlt(form: ApprovedTemplateForm) {
  const dltTemplateId = form.dltTemplateId.trim();
  const approvedContent = form.dltApprovedContent.trim();
  const name = form.name.trim();

  return {
    name,
    occasionId: form.occasionId,
    body: approvedContent.replace(APPROVED_DLT_SLOT_PATTERN, "{{name}}"),
  };
}

export default function AdvancedSmsTemplatesPage() {
  const { occasions } = useOccasions();
  const [templates, setTemplates] = useState<SmsTemplateSetupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [form, setForm] = useState<ApprovedTemplateForm>(
    emptyApprovedTemplateForm,
  );
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    function selectDefaultOccasion() {
      setForm((current) => {
        if (
          current.occasionId &&
          occasions.some((occasion) => occasion.id === current.occasionId)
        ) {
          return current;
        }
        return { ...current, occasionId: occasions[0]?.id ?? "" };
      });
    }
    if (occasions.length > 0) {
      selectDefaultOccasion();
    }
  }, [occasions]);

  useEffect(() => {
    async function loadTemplates() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          "/api/v1/templates?channel=SMS&isActive=all&limit=100&page=1",
        );
        const body = (await response.json()) as TemplatesResponse;

        if (!response.ok) {
          setError("Failed to load SMS templates");
          return;
        }

        setTemplates(
          body.data.map((template) => ({
            id: template.id,
            name: template.name,
            realSmsReady: template.realSmsReady,
            realSmsStatusLabel: template.realSmsStatusLabel,
          })),
        );
      } catch {
        setError("Failed to load SMS templates");
      } finally {
        setLoading(false);
      }
    }

    void loadTemplates();
  }, []);

  async function handleAddApprovedTemplate(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setCreatingTemplate(true);
    setFormError(null);

    try {
      const localTemplate = buildLocalTemplateFromDlt(form);
      const createResponse = await fetch("/api/v1/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: localTemplate.name,
          occasionId: localTemplate.occasionId,
          channel: "SMS",
          body: localTemplate.body,
          categoryId: null,
          isActive: true,
          replaceExisting: true,
        }),
      });
      const createBody = await createResponse.json();

      if (!createResponse.ok) {
        setFormError(
          createBody.error?.message ?? "Failed to add approved DLT template",
        );
        return;
      }

      const templateId = createBody.data.id;
      const setupResponse = await fetch(
        `/api/v1/templates/${templateId}/sms-setup`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dltTemplateId: form.dltTemplateId.trim(),
            dltApprovedContent: form.dltApprovedContent.trim(),
          }),
        },
      );
      const setupBody = await setupResponse.json();

      if (!setupResponse.ok) {
        setFormError(
          setupBody.error?.message ?? "Failed to save approved DLT settings",
        );
        return;
      }

      setTemplates((current) => [
        ...current.filter((template) => template.id !== templateId),
        {
          id: setupBody.data.id,
          name: setupBody.data.name,
          realSmsReady: setupBody.data.realSmsReady,
          realSmsStatusLabel: setupBody.data.realSmsStatusLabel,
        },
      ]);
      setForm(emptyApprovedTemplateForm);
      setShowAddForm(false);
    } catch {
      setFormError("Failed to add approved DLT template");
    } finally {
      setCreatingTemplate(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Advanced SMS Template Setup
        </h1>
      </div>

      {!showAddForm ? (
        <div>
          <button
            type="button"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
            onClick={() => setShowAddForm(true)}
          >
            Add approved DLT template
          </button>
        </div>
      ) : (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">
            Add approved DLT template
          </h2>
          <form className="mt-4 space-y-4" onSubmit={handleAddApprovedTemplate}>
            <label className="block text-sm">
              <span className="font-medium text-zinc-800">
                DLT template name
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-zinc-800">Occasion</span>
              <select
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                value={form.occasionId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    occasionId: event.target.value,
                  }))
                }
              >
                {occasions.map((occasion) => (
                  <option key={occasion.id} value={occasion.id}>
                    {occasion.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="font-medium text-zinc-800">DLT Template ID</span>
              <input
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                value={form.dltTemplateId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    dltTemplateId: event.target.value,
                  }))
                }
                required
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-zinc-800">
                Approved DLT content
              </span>
              <textarea
                className="mt-1 min-h-32 w-full rounded-lg border border-zinc-300 px-3 py-2"
                value={form.dltApprovedContent}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    dltApprovedContent: event.target.value,
                  }))
                }
                required
              />
            </label>

            {formError ? (
              <p className="text-sm text-red-600">{formError}</p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
                disabled={creatingTemplate}
              >
                {creatingTemplate ? "Adding..." : "Add approved template"}
              </button>
              <button
                type="button"
                className="rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-900"
                disabled={creatingTemplate}
                onClick={() => {
                  setShowAddForm(false);
                  setFormError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-zinc-600">Loading SMS templates...</p>
        ) : error ? (
          <p className="p-6 text-sm text-red-600">{error}</p>
        ) : templates.length === 0 ? (
          <div className="space-y-4 p-6">
            <p className="text-sm text-zinc-600">
              No SMS templates found. Add an approved DLT template to configure
              real SMS.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Template</th>
                  <th className="px-4 py-3 font-medium">Real SMS status</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id} className="border-b border-zinc-100">
                    <td className="px-4 py-3">{template.name}</td>
                    <td className="px-4 py-3">
                      {template.realSmsReady ? "Ready" : "Setup Required"}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/settings/sms/templates/${template.id}`}
                        className={compactSecondaryButtonClass}
                      >
                        {template.realSmsReady ? "Review Setup" : "Configure"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <SecondaryButtonLink href="/dashboard/settings/channels">
          Channels
        </SecondaryButtonLink>
        <SecondaryButtonLink href="/dashboard">Dashboard</SecondaryButtonLink>
      </div>
    </main>
  );
}
