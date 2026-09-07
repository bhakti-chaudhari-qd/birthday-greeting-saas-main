"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useOccasions } from "@/components/occasions/use-occasions";
import { InlineAlert } from "@/components/ui/feedback";
import {
  Panel,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/page";
import {
  ALL_CATEGORY_ID,
  applyAllCategoryPatch,
  buildAllCategoryRow,
  categoryGroupsDiffer,
  type CategoryAutomationDisplayRow,
} from "@/lib/automation/all-category-row";
import {
  formatAutomationSendTimeLabel,
  hour12ToHour24,
  hour24ToHour12,
} from "@/lib/automation/send-time";
import { templateMatchesAutomationCategory } from "@/lib/templates/serialize";

type TemplateOption = {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
};

type RuleRow = CategoryAutomationDisplayRow;

type OccasionDraft = {
  rows: RuleRow[];
  allRow: RuleRow;
  smsTemplates: TemplateOption[];
  whatsappTemplates: TemplateOption[];
  emailTemplates: TemplateOption[];
};

const timeSelectClass =
  "rounded-md border border-stone-300 bg-white px-1.5 py-1 text-sm text-stone-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
const DEFAULT_SEND_HOUR = 9;
const DEFAULT_SEND_MINUTE = 0;
const QUICK_MINUTES = [0, 15, 30, 45] as const;

function templatesForCategory(
  templates: TemplateOption[],
  categoryId: string,
): TemplateOption[] {
  const ruleCategoryId =
    categoryId === ALL_CATEGORY_ID ? null : categoryId;
  return templates.filter((template) =>
    templateMatchesAutomationCategory(template.categoryId, ruleCategoryId),
  );
}

function templateOptionLabel(template: TemplateOption) {
  if (!template.categoryName) {
    return `${template.name} (All groups)`;
  }
  return `${template.name} (${template.categoryName})`;
}

function hasEligibleTemplate(
  templates: TemplateOption[],
  templateId: string | null | undefined,
  categoryId: string,
): boolean {
  if (!templateId) {
    return false;
  }
  return templatesForCategory(templates, categoryId).some(
    (template) => template.id === templateId,
  );
}

function normalizeRowsForEligibleTemplates(
  rows: RuleRow[],
  sms: TemplateOption[],
  whatsapp: TemplateOption[],
  email: TemplateOption[],
): RuleRow[] {
  return rows.map((row) => {
    const smsTemplateValid = hasEligibleTemplate(
      sms,
      row.smsTemplateId,
      row.categoryId,
    );
    const whatsappTemplateValid = hasEligibleTemplate(
      whatsapp,
      row.whatsappTemplateId,
      row.categoryId,
    );
    const emailTemplateValid = hasEligibleTemplate(
      email,
      row.emailTemplateId,
      row.categoryId,
    );

    return {
      ...row,
      smsEnabled: row.smsEnabled && smsTemplateValid,
      smsTemplateId: smsTemplateValid ? row.smsTemplateId : null,
      whatsappEnabled: row.whatsappEnabled && whatsappTemplateValid,
      whatsappTemplateId: whatsappTemplateValid
        ? row.whatsappTemplateId
        : null,
      emailEnabled: row.emailEnabled && emailTemplateValid,
      emailTemplateId: emailTemplateValid ? row.emailTemplateId : null,
    };
  });
}

function emptyAllRow(): RuleRow {
  return {
    id: null,
    categoryId: ALL_CATEGORY_ID,
    categoryName: "All",
    contactCount: 0,
    sendHour: null,
    sendMinute: null,
    smsEnabled: false,
    smsTemplateId: null,
    whatsappEnabled: false,
    whatsappTemplateId: null,
    emailEnabled: false,
    emailTemplateId: null,
    callEnabled: false,
  };
}

function mapRulesPayload(rows: RuleRow[]) {
  return rows.map((row) => ({
    categoryId: row.categoryId,
    sendHour: row.sendHour,
    sendMinute: row.sendMinute,
    smsEnabled: row.smsEnabled,
    smsTemplateId: row.smsTemplateId,
    whatsappEnabled: row.whatsappEnabled,
    whatsappTemplateId: row.whatsappTemplateId,
    emailEnabled: row.emailEnabled,
    emailTemplateId: row.emailTemplateId,
    callEnabled: row.callEnabled,
  }));
}

function withDefaultSendTimeWhenActive(
  row: RuleRow,
  patch: Partial<RuleRow>,
): Partial<RuleRow> {
  const enablingChannel =
    patch.smsEnabled === true ||
    patch.whatsappEnabled === true ||
    patch.emailEnabled === true ||
    patch.callEnabled === true ||
    Boolean(patch.smsTemplateId) ||
    Boolean(patch.whatsappTemplateId) ||
    Boolean(patch.emailTemplateId);

  if (
    !enablingChannel ||
    row.sendHour !== null ||
    row.sendMinute !== null ||
    patch.sendHour !== undefined ||
    patch.sendMinute !== undefined
  ) {
    return patch;
  }

  return {
    ...patch,
    sendHour: DEFAULT_SEND_HOUR,
    sendMinute: DEFAULT_SEND_MINUTE,
  };
}

function applySuggestedTemplate(
  rows: RuleRow[],
  suggestedTemplateId: string | null,
  sms: TemplateOption[],
  whatsapp: TemplateOption[],
  email: TemplateOption[],
): { rows: RuleRow[]; applied: boolean } {
  if (!suggestedTemplateId) {
    return { rows, applied: false };
  }
  if (whatsapp.some((item) => item.id === suggestedTemplateId)) {
    return {
      rows: rows.map((row) => ({
        ...row,
        whatsappTemplateId: suggestedTemplateId,
      })),
      applied: true,
    };
  }
  if (sms.some((item) => item.id === suggestedTemplateId)) {
    return {
      rows: rows.map((row) => ({
        ...row,
        smsTemplateId: suggestedTemplateId,
      })),
      applied: true,
    };
  }
  if (email.some((item) => item.id === suggestedTemplateId)) {
    return {
      rows: rows.map((row) => ({
        ...row,
        emailTemplateId: suggestedTemplateId,
      })),
      applied: true,
    };
  }
  return { rows, applied: false };
}

function TimeSelects({
  sendHour,
  sendMinute,
  onChange,
  categoryName,
}: {
  sendHour: number | null;
  sendMinute: number | null;
  onChange: (hour: number | null, minute: number | null) => void;
  categoryName: string;
}) {
  const timeSet = sendHour !== null && sendMinute !== null;
  const [customMinuteOpen, setCustomMinuteOpen] = useState(false);
  const { hour12, period } = hour24ToHour12(timeSet ? sendHour : 9);
  const minuteIsQuick =
    timeSet &&
    QUICK_MINUTES.includes(sendMinute as (typeof QUICK_MINUTES)[number]);
  const quickMinuteValue =
    (timeSet && customMinuteOpen) || !minuteIsQuick
      ? "custom"
      : timeSet
      ? String(sendMinute)
      : String(DEFAULT_SEND_MINUTE);
  const timeInputValue = timeSet
    ? `${String(sendHour).padStart(2, "0")}:${String(sendMinute).padStart(2, "0")}`
    : "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
        Send at
      </span>
      {!timeSet ? (
        <button
          type="button"
          className="rounded-lg border border-dashed border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:border-stone-400 hover:bg-stone-50"
          onClick={() => onChange(9, 0)}
          aria-label={`Set send time for ${categoryName}`}
        >
          Not set — choose time
        </button>
      ) : (
        <>
          <div className="flex items-center gap-1">
            {quickMinuteValue === "custom" ? (
              <input
                type="time"
                className={`${timeSelectClass} w-28`}
                value={timeInputValue}
                onChange={(event) => {
                  const [nextHour, nextMinute] = event.target.value
                    .split(":")
                    .map(Number);
                  if (
                    !Number.isInteger(nextHour) ||
                    !Number.isInteger(nextMinute)
                  ) {
                    return;
                  }
                  onChange(nextHour, nextMinute);
                }}
                aria-label={`Custom send time for ${categoryName}`}
              />
            ) : (
              <>
                <select
                  className={`${timeSelectClass} w-11`}
                  value={hour12}
                  onChange={(event) => {
                    const nextHour12 = Number(event.target.value);
                    onChange(hour12ToHour24(nextHour12, period), sendMinute);
                  }}
                  aria-label={`Send hour for ${categoryName}`}
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map(
                    (hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ),
                  )}
                </select>
                <span className="text-stone-400">:</span>
              </>
            )}
            <select
              className={`${timeSelectClass} w-20`}
              value={quickMinuteValue}
              onChange={(event) => {
                if (event.target.value === "custom") {
                  setCustomMinuteOpen(true);
                  onChange(sendHour, sendMinute ?? 0);
                  return;
                }
                setCustomMinuteOpen(false);
                onChange(sendHour, Number(event.target.value));
              }}
              aria-label={`Send minute for ${categoryName}`}
            >
              {QUICK_MINUTES.map((minute) => (
                <option key={minute} value={minute}>
                  {String(minute).padStart(2, "0")}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
            {quickMinuteValue !== "custom" ? (
              <select
                className={`${timeSelectClass} w-12`}
                value={period}
                onChange={(event) => {
                  const nextPeriod = event.target.value as "AM" | "PM";
                  onChange(hour12ToHour24(hour12, nextPeriod), sendMinute);
                }}
                aria-label={`AM or PM for ${categoryName}`}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            ) : null}
          </div>
          <span className="text-xs text-stone-500">IST</span>
          <button
            type="button"
            className="text-xs font-medium text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
            onClick={() => onChange(null, null)}
            aria-label={`Clear send time for ${categoryName}`}
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}

function ChannelRow({
  label,
  enabled,
  templateId,
  templates,
  categoryName,
  onEnabledChange,
  onTemplateChange,
  statusWhenOn,
}: {
  label: string;
  enabled: boolean;
  templateId?: string | null;
  templates?: TemplateOption[];
  categoryName: string;
  onEnabledChange: (enabled: boolean) => void;
  onTemplateChange?: (templateId: string | null) => void;
  /** Shown when enabled and there is no template picker (e.g. Email / Call). */
  statusWhenOn?: string;
}) {
  const hasTemplates = Boolean(templates && onTemplateChange);

  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <label className="flex shrink-0 items-center gap-2 text-sm text-stone-800">
          <input
            type="checkbox"
            className="size-4 rounded border-stone-300 text-primary focus:ring-primary"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
            aria-label={`Enable ${label} for ${categoryName}`}
          />
          <span className="font-medium">{label}</span>
        </label>
        {enabled && hasTemplates ? (
          <select
            className={`${inputClass} min-w-0 max-w-[14rem] flex-1 py-1.5`}
            value={templateId ?? ""}
            onChange={(event) =>
              onTemplateChange?.(event.target.value || null)
            }
            aria-label={`${label} template for ${categoryName}`}
          >
            <option value="">Choose a template…</option>
            {templates!.map((template) => (
              <option key={template.id} value={template.id}>
                {templateOptionLabel(template)}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {enabled && !hasTemplates && statusWhenOn ? (
        <p className="text-sm text-stone-500">{statusWhenOn}</p>
      ) : null}
    </div>
  );
}

export function CategoryAutomationTable() {
  const { occasions } = useOccasions();
  const [occasionId, setOccasionId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("occasionId") ?? "";
  });
  const [suggestedTemplateId] = useState(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("templateId"),
  );
  const [drafts, setDrafts] = useState<Partial<Record<string, OccasionDraft>>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    function selectDefaultOccasion() {
      setOccasionId((current) => {
        if (current && occasions.some((occasion) => occasion.id === current)) {
          return current;
        }
        return occasions[0]?.id ?? "";
      });
    }
    if (occasions.length > 0) {
      selectDefaultOccasion();
    }
  }, [occasions]);

  const loadAll = useCallback(async () => {
    if (occasions.length === 0) {
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const responses = await Promise.all(
        occasions.map(async (occasion) => {
          const response = await fetch(
            `/api/v1/settings/category-automation?occasionId=${occasion.id}`,
          );
          const body = await response.json();
          if (!response.ok) {
            throw new Error(
              body.error?.message ?? "Failed to load category routes",
            );
          }
          return { type: occasion.id, data: body.data };
        }),
      );

      const nextDrafts: Partial<Record<string, OccasionDraft>> = {};
      let suggestionApplied = false;

      for (const { type, data } of responses) {
        const nextSms = data.eligibleSmsTemplates as TemplateOption[];
        const nextWhatsApp =
          data.eligibleWhatsAppTemplates as TemplateOption[];
        const nextEmail = data.eligibleEmailTemplates as TemplateOption[];
        let nextRows = normalizeRowsForEligibleTemplates(
          data.rules as RuleRow[],
          nextSms,
          nextWhatsApp,
          nextEmail,
        );

        if (!suggestionApplied && suggestedTemplateId) {
          const applied = applySuggestedTemplate(
            nextRows,
            suggestedTemplateId,
            nextSms,
            nextWhatsApp,
            nextEmail,
          );
          nextRows = applied.rows;
          suggestionApplied = applied.applied;
        }

        nextDrafts[type] = {
          rows: nextRows,
          allRow:
            nextRows.length > 0 ? buildAllCategoryRow(nextRows) : emptyAllRow(),
          smsTemplates: nextSms,
          whatsappTemplates: nextWhatsApp,
          emailTemplates: nextEmail,
        };
      }

      setDrafts(nextDrafts);
      if (suggestionApplied) {
        setSuccess(
          "Your message is selected. Turn on the channel for the groups that should receive it, then Save.",
        );
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load category routes",
      );
    } finally {
      setLoading(false);
    }
  }, [occasions, suggestedTemplateId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAll(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAll]);

  const activeDraft = drafts[occasionId];
  const rows = activeDraft?.rows ?? [];
  const allRow = activeDraft?.allRow ?? emptyAllRow();
  const smsTemplates = activeDraft?.smsTemplates ?? [];
  const whatsappTemplates = activeDraft?.whatsappTemplates ?? [];
  const emailTemplates = activeDraft?.emailTemplates ?? [];

  function updateRow(categoryId: string, patch: Partial<RuleRow>) {
    setDrafts((current) => {
      const draft = current[occasionId];
      if (!draft) {
        return current;
      }

      const nextRows =
        categoryId === ALL_CATEGORY_ID
              ? applyAllCategoryPatch(draft.rows, patch)
          : draft.rows.map((row) =>
              row.categoryId === categoryId
                ? { ...row, ...withDefaultSendTimeWhenActive(row, patch) }
                : row,
            );

      const nextAllRow =
        categoryId === ALL_CATEGORY_ID
          ? {
              ...draft.allRow,
              ...patch,
              id: null,
              categoryId: ALL_CATEGORY_ID,
              categoryName: "All",
              contactCount: nextRows.reduce(
                (sum, row) => sum + row.contactCount,
                0,
              ),
            }
          : buildAllCategoryRow(nextRows);

      return {
        ...current,
        [occasionId]: {
          ...draft,
          rows: nextRows,
          allRow: nextAllRow,
        },
      };
    });
    setSuccess(null);
  }

  async function handleSave() {
    const occasionPayloads = occasions.flatMap((occasion) => {
      const draft = drafts[occasion.id];
      if (!draft) {
        return [];
      }
      const rows = normalizeRowsForEligibleTemplates(
        draft.rows,
        draft.smsTemplates,
        draft.whatsappTemplates,
        draft.emailTemplates,
      );
      return [
        {
          occasionId: occasion.id,
          rules: mapRulesPayload(rows),
        },
      ];
    });

    if (occasionPayloads.length === 0) {
      setError("Nothing to save yet. Wait for categories to load.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/v1/settings/category-automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occasions: occasionPayloads }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error?.message ?? "Failed to save greeting routes");
        return;
      }

      type SavedOccasionPayload = {
        occasionId: string;
        rules: RuleRow[];
        eligibleSmsTemplates: TemplateOption[];
        eligibleWhatsAppTemplates: TemplateOption[];
        eligibleEmailTemplates: TemplateOption[];
      };
      const savedOccasions: SavedOccasionPayload[] = Array.isArray(
        body.data?.occasions,
      )
        ? (body.data.occasions as SavedOccasionPayload[])
        : body.data?.occasionId
          ? [body.data as SavedOccasionPayload]
          : [];

      setDrafts((current) => {
        const next = { ...current };
        for (const saved of savedOccasions) {
          const existing = next[saved.occasionId];
          next[saved.occasionId] = {
            rows: saved.rules,
            allRow:
              saved.rules.length > 0
                ? buildAllCategoryRow(saved.rules)
                : emptyAllRow(),
            smsTemplates:
              saved.eligibleSmsTemplates ?? existing?.smsTemplates ?? [],
            whatsappTemplates:
              saved.eligibleWhatsAppTemplates ??
              existing?.whatsappTemplates ??
              [],
            emailTemplates:
              saved.eligibleEmailTemplates ?? existing?.emailTemplates ?? [],
          };
        }
        return next;
      });
      setSuccess("All automatic greetings saved.");
    } catch {
      setError("Failed to save greeting routes");
    } finally {
      setSaving(false);
    }
  }

  const displayRows = useMemo(
    () => (rows.length === 0 ? [] : [allRow, ...rows]),
    [allRow, rows],
  );
  const groupsDiffer = categoryGroupsDiffer(rows);
  const canSave =
    !saving &&
    !loading &&
    occasions.some((occasion) => (drafts[occasion.id]?.rows.length ?? 0) > 0);

  return (
    <Panel className="space-y-5 p-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Occasion">
        {occasions.map((occasion) => (
          <button
            key={occasion.id}
            type="button"
            role="tab"
            aria-selected={occasionId === occasion.id}
            className={
              occasionId === occasion.id
                ? primaryButtonClass
                : secondaryButtonClass
            }
            onClick={() => setOccasionId(occasion.id)}
          >
            {occasion.name}
          </button>
        ))}
      </div>

      <p className="text-sm text-stone-600">
        Switch occasions to edit their automatic greetings. One Save keeps all
        of them.
      </p>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {success ? <InlineAlert tone="success">{success}</InlineAlert> : null}

      {loading ? (
        <p className="text-sm text-stone-600">Loading categories…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-stone-600">
          No categories yet. Add categories on the Contacts page first.
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 border-y border-stone-200">
          {displayRows.map((row) => {
            const isAll = row.categoryId === ALL_CATEGORY_ID;
            const active =
              (row.smsEnabled && row.smsTemplateId) ||
              (row.whatsappEnabled && row.whatsappTemplateId) ||
              (row.emailEnabled && row.emailTemplateId) ||
              row.callEnabled;

            return (
              <li
                key={row.categoryId}
                className={[
                  "space-y-4 py-5 first:pt-4 last:pb-4",
                  isAll ? "bg-stone-50/80" : "",
                ].join(" ")}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <h3 className="text-base font-semibold text-stone-900">
                        {row.categoryName}
                      </h3>
                      {active ? (
                        <span className="text-xs font-medium text-emerald-700">
                          {row.sendHour !== null && row.sendMinute !== null
                            ? `Active · ${formatAutomationSendTimeLabel(row.sendHour, row.sendMinute)} IST`
                            : "Active · Not Set - Choose Time"}
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400">Not sending</span>
                      )}
                    </div>
                    {isAll ? (
                      <p className="mt-1 text-sm text-stone-600">
                        Applies the same greeting to every group for this
                        occasion.
                        {groupsDiffer
                          ? " Groups currently differ - edit All to set them the same."
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <TimeSelects
                    categoryName={row.categoryName}
                    sendHour={row.sendHour}
                    sendMinute={row.sendMinute}
                    onChange={(hour, minute) =>
                      updateRow(row.categoryId, {
                        sendHour: hour,
                        sendMinute: minute,
                      })
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <ChannelRow
                    label="SMS"
                    enabled={row.smsEnabled}
                    templateId={row.smsTemplateId}
                    templates={templatesForCategory(smsTemplates, row.categoryId)}
                    categoryName={row.categoryName}
                    onEnabledChange={(smsEnabled) =>
                      updateRow(
                        row.categoryId,
                        withDefaultSendTimeWhenActive(row, { smsEnabled }),
                      )
                    }
                    onTemplateChange={(smsTemplateId) =>
                      updateRow(
                        row.categoryId,
                        withDefaultSendTimeWhenActive(row, { smsTemplateId }),
                      )
                    }
                  />
                  <ChannelRow
                    label="WhatsApp"
                    enabled={row.whatsappEnabled}
                    templateId={row.whatsappTemplateId}
                    templates={templatesForCategory(
                      whatsappTemplates,
                      row.categoryId,
                    )}
                    categoryName={row.categoryName}
                    onEnabledChange={(whatsappEnabled) =>
                      updateRow(
                        row.categoryId,
                        withDefaultSendTimeWhenActive(row, { whatsappEnabled }),
                      )
                    }
                    onTemplateChange={(whatsappTemplateId) =>
                      updateRow(
                        row.categoryId,
                        withDefaultSendTimeWhenActive(row, {
                          whatsappTemplateId,
                        }),
                      )
                    }
                  />
                  <ChannelRow
                    label="Email"
                    enabled={row.emailEnabled}
                    templateId={row.emailTemplateId}
                    templates={templatesForCategory(
                      emailTemplates,
                      row.categoryId,
                    )}
                    categoryName={row.categoryName}
                    onEnabledChange={(emailEnabled) =>
                      updateRow(
                        row.categoryId,
                        withDefaultSendTimeWhenActive(row, { emailEnabled }),
                      )
                    }
                    onTemplateChange={(emailTemplateId) =>
                      updateRow(
                        row.categoryId,
                        withDefaultSendTimeWhenActive(row, { emailTemplateId }),
                      )
                    }
                  />
                  <ChannelRow
                    label="Call"
                    enabled={row.callEnabled}
                    categoryName={row.categoryName}
                    onEnabledChange={(callEnabled) =>
                      updateRow(
                        row.categoryId,
                        withDefaultSendTimeWhenActive(row, { callEnabled }),
                      )
                    }
                    statusWhenOn="Delivery coming soon"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          className={primaryButtonClass}
          disabled={!canSave}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Panel>
  );
}
