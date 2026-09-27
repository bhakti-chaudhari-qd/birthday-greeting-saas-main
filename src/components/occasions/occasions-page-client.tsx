"use client";

import { useEffect, useState } from "react";

import { DeleteOccasionDialog } from "@/components/occasions/delete-occasion-dialog";
import { OccasionFormModal } from "@/components/occasions/occasion-form-modal";
import { EmptyState, InlineAlert, StatusBadge } from "@/components/ui/feedback";
import {
  PageHeader,
  PageShell,
  Panel,
  compactSecondaryButtonClass,
  primaryButtonClass,
} from "@/components/ui/page";
import { getOccasionsDict } from "@/lib/i18n/dictionaries/occasions";
import { useLocale } from "@/lib/i18n/use-locale";

type OccasionRow = {
  id: string;
  name: string;
  isSystem: boolean;
  contactCount?: number;
  automationCount?: number;
  templateCount?: number;
};

export function OccasionsPageClient() {
  const dict = getOccasionsDict(useLocale()).manage;
  const [occasions, setOccasions] = useState<OccasionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formModal, setFormModal] = useState<
    { open: false } | { open: true; mode: "create" } | { open: true; mode: "edit"; occasion: OccasionRow }
  >({ open: false });
  const [pendingDelete, setPendingDelete] = useState<OccasionRow | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    async function loadOccasions() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/v1/occasions");
        const body = await response.json();
        if (!response.ok) {
          setError(body.error?.message ?? dict.couldNotLoad);
          return;
        }
        setOccasions(body.data as OccasionRow[]);
      } catch {
        setError(dict.couldNotLoadConnection);
      } finally {
        setLoading(false);
      }
    }
    void loadOccasions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadToken]);

  return (
    <PageShell>
      <PageHeader
        title={dict.title}
        description={dict.description}
        actions={
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => setFormModal({ open: true, mode: "create" })}
          >
            {dict.addOccasion}
          </button>
        }
      />

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <Panel>
        {loading ? (
          <p className="p-6 text-sm text-stone-600">{dict.loading}</p>
        ) : occasions.length === 0 ? (
          <EmptyState
            title={dict.emptyTitle}
            description={dict.emptyDescription}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{dict.colOccasion}</th>
                  <th className="px-4 py-2.5 font-medium">{dict.colStatus}</th>
                  <th className="px-4 py-2.5 font-medium">{dict.colContactsUsing}</th>
                  <th className="px-4 py-2.5 font-medium">{dict.colAutomationsUsing}</th>
                  <th className="px-4 py-2.5 font-medium">
                    <span className="sr-only">{dict.actionsSr}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {occasions.map((occasion) => (
                  <tr
                    key={occasion.id}
                    className="border-b border-stone-100 last:border-0"
                  >
                    <td className="px-4 py-2.5 font-medium text-stone-900">
                      {occasion.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={occasion.isSystem ? dict.statusSystem : dict.statusActive}
                        tone={occasion.isSystem ? "info" : "success"}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-stone-600">
                      {occasion.contactCount ?? 0}
                    </td>
                    <td className="px-4 py-2.5 text-stone-600">
                      {occasion.automationCount ?? 0}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          className={compactSecondaryButtonClass}
                          onClick={() =>
                            setFormModal({ open: true, mode: "edit", occasion })
                          }
                        >
                          {dict.edit}
                        </button>
                        <button
                          type="button"
                          className={compactSecondaryButtonClass}
                          disabled={occasion.isSystem}
                          title={
                            occasion.isSystem
                              ? dict.birthdayCannotBeDeleted
                              : undefined
                          }
                          onClick={() => setPendingDelete(occasion)}
                        >
                          {dict.delete}
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

      <OccasionFormModal
        open={formModal.open}
        mode={formModal.open ? formModal.mode : "create"}
        occasionId={formModal.open && formModal.mode === "edit" ? formModal.occasion.id : undefined}
        initialName={formModal.open && formModal.mode === "edit" ? formModal.occasion.name : ""}
        onClose={() => setFormModal({ open: false })}
        onSaved={() => {
          setFormModal({ open: false });
          setReloadToken((token) => token + 1);
        }}
      />

      <DeleteOccasionDialog
        open={pendingDelete !== null}
        occasionId={pendingDelete?.id ?? null}
        occasionName={pendingDelete?.name ?? ""}
        onClose={() => setPendingDelete(null)}
        onDeleted={() => {
          setPendingDelete(null);
          setReloadToken((token) => token + 1);
        }}
      />
    </PageShell>
  );
}
