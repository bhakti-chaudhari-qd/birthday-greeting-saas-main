"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DocumentTemplatesManager } from "@/components/document-templates/document-templates-page-client";
import { Modal } from "@/components/ui/modal";
import { EmptyState, InlineAlert } from "@/components/ui/feedback";
import {
  PageHeader,
  PageShell,
  Panel,
  PrimaryButtonLink,
  SecondaryButtonLink,
  compactSecondaryButtonClass,
  inputClass,
  secondaryButtonClass,
} from "@/components/ui/page";
import { getTemplatesDict } from "@/lib/i18n/dictionaries/templates";
import { translateOccasionName } from "@/lib/i18n/occasion-labels";
import { useLocale } from "@/lib/i18n/use-locale";

type TemplateTab = "MESSAGE" | "DOCUMENT";

type TemplateChannel = "SMS" | "WHATSAPP" | "EMAIL";

type Template = {
  id: string;
  name: string;
  occasionName: string | null;
  channel: TemplateChannel;
  categoryName: string | null;
  contentPreview: string;
  isActive: boolean;
  emailSubject: string | null;
  dltTemplateId: string | null;
  whatsappProviderTemplateId: string | null;
  whatsappLanguage: string | null;
};

type TemplatesResponse = {
  data: Template[];
};

function channelFromSearchParam(value: string | null): TemplateChannel {
  if (value === "WHATSAPP" || value === "EMAIL") {
    return value;
  }
  return "SMS";
}

export function TemplatesPageClient({ canManage }: { canManage: boolean }) {
  const locale = useLocale();
  const dict = getTemplatesDict(locale).page;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [topTab, setTopTab] = useState<TemplateTab>("MESSAGE");
  const [channel, setChannel] = useState<TemplateChannel>(() =>
    channelFromSearchParam(searchParams.get("channel")),
  );
  const [search, setSearch] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const templateTabs: Array<{ value: TemplateTab; label: string }> = [
    { value: "MESSAGE", label: dict.tabMessageTemplates },
    { value: "DOCUMENT", label: dict.tabDocumentTemplates },
  ];

  const channelTabs: Array<{ value: TemplateChannel; label: string }> = [
    { value: "SMS", label: dict.channelSms },
    { value: "WHATSAPP", label: dict.channelWhatsapp },
    { value: "EMAIL", label: dict.channelEmail },
  ];

  useEffect(() => {
    const query = channel === "SMS" ? "" : `?channel=${channel}`;
    router.replace(`/dashboard/templates${query}`, { scroll: false });
  }, [channel, router]);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          channel,
          isActive: "all",
          limit: "100",
          page: "1",
        });
        const response = await fetch(`/api/v1/templates?${params.toString()}`, {
          cache: "no-store",
        });
        const body = (await response.json()) as TemplatesResponse & {
          error?: { message?: string };
        };

        if (!response.ok) {
          if (!cancelled) {
            setError(body.error?.message ?? dict.failedToLoad);
            setTemplates([]);
          }
          return;
        }

        if (!cancelled) {
          setTemplates(body.data);
        }
      } catch {
        if (!cancelled) {
          setError(dict.failedToLoad);
          setTemplates([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTemplates();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return templates;
    }
    return templates.filter(
      (template) =>
        template.name.toLowerCase().includes(query) ||
        (template.occasionName ?? "").toLowerCase().includes(query) ||
        (template.occasionName
          ? translateOccasionName(template.occasionName, locale).toLowerCase().includes(query)
          : false),
    );
  }, [templates, search, locale]);

  async function handleConfirmDelete() {
    if (!pendingDelete) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/v1/templates/${pendingDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setDeleteError(body.error?.message ?? dict.failedToDelete);
        return;
      }

      setTemplates((current) =>
        current.filter((template) => template.id !== pendingDelete.id),
      );
      setPendingDelete(null);
    } catch {
      setDeleteError(dict.failedToDelete);
    } finally {
      setDeleting(false);
    }
  }

  const addTemplateHref = `/dashboard/templates/new?channel=${channel}`;

  return (
    <PageShell>
      <PageHeader
        title={dict.title}
        description={dict.description}
        actions={
          topTab === "MESSAGE" ? (
            canManage ? (
              <PrimaryButtonLink href={addTemplateHref}>
                {dict.addApprovedTemplate}
              </PrimaryButtonLink>
            ) : undefined
          ) : (
            <SecondaryButtonLink href="/dashboard/generated-documents">
              {dict.generatedDocuments}
            </SecondaryButtonLink>
          )
        }
      />

      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label={dict.templateTypeAriaLabel}
      >
        {templateTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={topTab === tab.value}
            className={[
              "rounded-full px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              topTab === tab.value
                ? "bg-stone-900 text-white"
                : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50",
            ].join(" ")}
            onClick={() => setTopTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {topTab === "DOCUMENT" ? (
        <DocumentTemplatesManager />
      ) : (
        <>
          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-label={dict.channelAriaLabel}
          >
            {channelTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={channel === tab.value}
                className={[
                  "rounded-full px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  channel === tab.value
                    ? "bg-primary text-white"
                    : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50",
                ].join(" ")}
                onClick={() => setChannel(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <label className="block max-w-sm text-sm">
            <span className="sr-only">{dict.searchLabel}</span>
            <input
              className={inputClass}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={dict.searchPlaceholder}
            />
          </label>

          {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

          <Panel>
            {loading ? (
              <p className="p-6 text-sm text-stone-600">{dict.loading}</p>
            ) : filteredTemplates.length === 0 ? (
              templates.length === 0 ? (
                <EmptyState
                  title={dict.emptyTitle}
                  description={dict.emptyDescription}
                  actionHref={canManage ? addTemplateHref : undefined}
                  actionLabel={canManage ? dict.addTemplateAction : undefined}
                />
              ) : (
                <p className="p-6 text-sm text-stone-600">{dict.noMatch(search)}</p>
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">
                        {dict.columnTemplateName}
                      </th>
                      {channel === "WHATSAPP" ? (
                        <th className="px-4 py-3 font-medium">
                          {dict.columnTemplateId}
                        </th>
                      ) : null}
                      {channel === "WHATSAPP" ? (
                        <th className="px-4 py-3 font-medium">
                          {dict.columnLanguage}
                        </th>
                      ) : null}
                      <th className="px-4 py-3 font-medium">{dict.columnOccasion}</th>
                      {channel === "SMS" ? (
                        <th className="px-4 py-3 font-medium">
                          {dict.columnTemplateId}
                        </th>
                      ) : null}
                      {channel === "EMAIL" ? (
                        <th className="px-4 py-3 font-medium">{dict.columnSubject}</th>
                      ) : null}
                      <th className="px-4 py-3 font-medium">{dict.columnPreview}</th>
                      <th className="px-4 py-3 font-medium">{dict.columnActions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTemplates.map((template) => (
                      <tr key={template.id} className="border-b border-stone-100 last:border-0">
                        <td className="px-4 py-3 font-medium text-stone-900">
                          {template.name}
                        </td>
                        {channel === "WHATSAPP" ? (
                          <td className="px-4 py-3 text-stone-600">
                            {template.whatsappProviderTemplateId || "-"}
                          </td>
                        ) : null}
                        {channel === "WHATSAPP" ? (
                          <td className="px-4 py-3 text-stone-600">
                            {template.whatsappLanguage || "-"}
                          </td>
                        ) : null}
                        <td className="px-4 py-3 text-stone-600">
                          {template.occasionName
                            ? translateOccasionName(template.occasionName, locale)
                            : "—"}
                        </td>
                        {channel === "SMS" ? (
                          <td className="px-4 py-3 text-stone-600">
                            {template.dltTemplateId || "-"}
                          </td>
                        ) : null}
                        {channel === "EMAIL" ? (
                          <td className="px-4 py-3 text-stone-600">
                            {template.emailSubject || "-"}
                          </td>
                        ) : null}
                        <td
                          className="max-w-xs truncate px-4 py-3 text-stone-600"
                          title={template.contentPreview}
                        >
                          {template.contentPreview}
                          {!template.isActive ? (
                            <span className="ml-2 text-xs text-amber-700">
                              {dict.inactiveTag}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          {canManage ? (
                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={`/dashboard/templates/${template.id}/edit`}
                                className={compactSecondaryButtonClass}
                              >
                                {dict.edit}
                              </Link>
                              <button
                                type="button"
                                className={compactSecondaryButtonClass}
                                onClick={() => {
                                  setDeleteError(null);
                                  setPendingDelete(template);
                                }}
                              >
                                {dict.delete}
                              </button>
                            </div>
                          ) : (
                            <span className="text-stone-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      <Modal
        open={pendingDelete !== null}
        onClose={() => {
          if (deleting) return;
          setPendingDelete(null);
          setDeleteError(null);
        }}
        title={dict.deleteModalTitle}
      >
        <p className="text-sm text-stone-700">
          {pendingDelete ? dict.deleteConfirmText(pendingDelete.name) : ""}
        </p>
        {deleteError ? (
          <div className="mt-3">
            <InlineAlert tone="error">{deleteError}</InlineAlert>
          </div>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={deleting}
            onClick={() => {
              setPendingDelete(null);
              setDeleteError(null);
            }}
          >
            {dict.cancel}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white outline-none transition-colors hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={deleting}
            onClick={() => void handleConfirmDelete()}
          >
            {deleting ? dict.deleting : dict.delete}
          </button>
        </div>
      </Modal>
    </PageShell>
  );
}
