"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Channel } from "@prisma/client";

import { useOccasions } from "@/components/occasions/use-occasions";
import { Drawer } from "@/components/ui/drawer";
import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/page";
import type { CategoryAutomationSettingsView } from "@/lib/automation/category-settings";

import { CategoryMultiSelect } from "./category-multi-select";
import { buildRulePayload, toPayloadRule, type ChannelSelection } from "./rule-utils";
import { CHANNEL_LABEL, type AutomationCardData, type OrgCategory } from "./types";

type SettingsByOccasion = Partial<Record<string, CategoryAutomationSettingsView>>;

export type AutomationDrawerProps = {
  open: boolean;
  onClose: () => void;
  automation: AutomationCardData | null;
  categories: OrgCategory[];
  settingsByOccasion: SettingsByOccasion;
  onSaved: (occasionId: string) => Promise<void> | void;
};

type ChannelStatus = { configured: boolean; isActive: boolean } | null;

type ChannelFormState = { enabled: boolean; templateId: string };

type PreviewState = { body: string; previewMessage: string; emailSubject: string | null };

const CHANNELS: Channel[] = ["WHATSAPP", "EMAIL", "SMS"];

function emptyChannelForm(): Record<Channel, ChannelFormState> {
  return {
    WHATSAPP: { enabled: false, templateId: "" },
    EMAIL: { enabled: false, templateId: "" },
    SMS: { enabled: false, templateId: "" },
  };
}

function toHhmm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatHhmmLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) {
    return "Not set";
  }
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function AutomationDrawer({
  open,
  onClose,
  automation,
  categories,
  settingsByOccasion,
  onSaved,
}: AutomationDrawerProps) {
  const isEdit = automation !== null;

  const { occasions } = useOccasions();
  const [occasionId, setOccasionId] = useState("");
  const occasionLabel =
    occasions.find((occasion) => occasion.id === occasionId)?.name ?? "";
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [sendTime, setSendTime] = useState("09:00");
  const [channelForm, setChannelForm] = useState<Record<Channel, ChannelFormState>>(emptyChannelForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [previews, setPreviews] = useState<Partial<Record<Channel, PreviewState>>>({});
  const [previewLoading, setPreviewLoading] = useState<Channel | null>(null);

  const [channelStatus, setChannelStatus] = useState<{
    sms: ChannelStatus;
    whatsapp: ChannelStatus;
  }>({ sms: null, whatsapp: null });

  useEffect(() => {
    function resetForm() {
      if (!open) {
        return;
      }
      setError(null);
      setPreviews({});
      if (automation) {
        setOccasionId(automation.occasionId);
        setCategoryIds([automation.categoryId]);
        setSendTime(toHhmm(automation.sendHour, automation.sendMinute));
        const next = emptyChannelForm();
        for (const channel of automation.channels) {
          next[channel.channel] = { enabled: true, templateId: channel.templateId };
        }
        setChannelForm(next);
      } else {
        setOccasionId(occasions[0]?.id ?? "");
        setCategoryIds([]);
        setSendTime("09:00");
        setChannelForm(emptyChannelForm());
      }
    }
    resetForm();
  }, [open, automation, occasions]);

  useEffect(() => {
    if (!open) {
      return;
    }
    async function loadChannelStatus() {
      try {
        const [smsRes, waRes] = await Promise.all([
          fetch("/api/v1/channel-config/sms"),
          fetch("/api/v1/channel-config/whatsapp"),
        ]);
        const [smsBody, waBody] = await Promise.all([smsRes.json(), waRes.json()]);
        setChannelStatus({
          sms: smsRes.ok ? { configured: smsBody.data?.configured, isActive: smsBody.data?.isActive } : null,
          whatsapp: waRes.ok
            ? { configured: waBody.data?.configured, isActive: waBody.data?.isActive }
            : null,
        });
      } catch {
        // Status line is optional context, not a blocker.
      }
    }
    void loadChannelStatus();
  }, [open]);

  const selectedCategories = useMemo(
    () => categories.filter((category) => categoryIds.includes(category.id)),
    [categories, categoryIds],
  );
  const categoryName = useMemo(
    () =>
      selectedCategories.length === 1
        ? selectedCategories[0]!.name
        : selectedCategories.length > 1
          ? `${selectedCategories.length} categories`
          : "",
    [selectedCategories],
  );
  const categoryReviewLabel = useMemo(
    () =>
      selectedCategories.length === 1
        ? selectedCategories[0]!.name
        : selectedCategories.length > 1
          ? `${selectedCategories.length} Categories`
          : "",
    [selectedCategories],
  );
  const automationReviewLabel =
    occasionLabel && categoryReviewLabel
      ? `${occasionLabel} • ${categoryReviewLabel}`
      : "";

  const settings = settingsByOccasion[occasionId];
  const existingRules = useMemo(
    () =>
      settings?.rules.filter((rule) => categoryIds.includes(rule.categoryId)) ??
      [],
    [settings, categoryIds],
  );
  const alreadyConfigured =
    !isEdit &&
    existingRules.some((rule) =>
      Boolean(rule.smsTemplateId || rule.whatsappTemplateId || rule.emailTemplateId),
    );

  function eligibleTemplatesFor(channel: Channel) {
    if (!settings) return [];
    const list =
      channel === "SMS"
        ? settings.eligibleSmsTemplates
        : channel === "WHATSAPP"
          ? settings.eligibleWhatsAppTemplates
          : settings.eligibleEmailTemplates;
    if (categoryIds.length === 0) {
      return [];
    }
    return list.filter((template) =>
      categoryIds.every(
        (categoryId) =>
          template.categoryId === null || template.categoryId === categoryId,
      ),
    );
  }

  function loadPreview(channel: Channel, templateId: string) {
    if (!templateId) {
      setPreviews((current) => ({ ...current, [channel]: undefined }));
      return;
    }
    setPreviewLoading(channel);
    fetch(`/api/v1/templates/${templateId}`)
      .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
      .then(({ ok, body }) => {
        if (ok) {
          setPreviews((current) => ({
            ...current,
            [channel]: {
              body: body.data.body,
              previewMessage: body.data.previewMessage,
              emailSubject: body.data.emailSubject,
            },
          }));
        }
      })
      .catch(() => {
        // Preview is a convenience, not required to save.
      })
      .finally(() => setPreviewLoading((current) => (current === channel ? null : current)));
  }

  function toggleChannel(channel: Channel, enabled: boolean) {
    setChannelForm((current) => ({
      ...current,
      [channel]: { enabled, templateId: enabled ? current[channel].templateId : "" },
    }));
  }

  function setChannelTemplate(channel: Channel, templateId: string) {
    setChannelForm((current) => ({ ...current, [channel]: { ...current[channel], templateId } }));
    loadPreview(channel, templateId);
  }

  const selectedChannels = CHANNELS.filter((c) => channelForm[c].enabled);
  const canSave =
    categoryIds.length > 0 &&
    Boolean(sendTime) &&
    selectedChannels.length > 0 &&
    selectedChannels.every((c) => Boolean(channelForm[c].templateId)) &&
    !alreadyConfigured;

  async function handleSave() {
    if (!canSave) {
      setError("Choose a category, at least one channel with a template, and a send time.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const [hourStr, minuteStr] = sendTime.split(":");
      const sendHour = Number(hourStr);
      const sendMinute = Number(minuteStr);
      const rules = settings?.rules ?? [];

      const channelSelections: ChannelSelection[] = CHANNELS.map((channel) => ({
        channel,
        checked: channelForm[channel].enabled,
        templateId: channelForm[channel].templateId || null,
      }));

      // Editing shouldn't silently resume a paused automation - only new ones start active.
      const overallActive = isEdit ? automation?.status === "active" : true;
      const selectedCategoryIdSet = new Set(categoryIds);
      const nextRules = rules
        .filter((rule) => !selectedCategoryIdSet.has(rule.categoryId))
        .map(toPayloadRule);

      for (const selectedCategoryId of categoryIds) {
        nextRules.push(
          buildRulePayload(
            selectedCategoryId,
            sendHour,
            sendMinute,
            channelSelections,
            overallActive,
          ),
        );
      }

      const response = await fetch("/api/v1/settings/category-automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occasionId, rules: nextRules }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error?.message ?? "Could not save automation.");
        return;
      }

      await onSaved(occasionId);
      onClose();
    } catch {
      setError("Could not save automation. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const title = isEdit ? `${categoryName} ${occasionLabel}` : "Create Automation";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      description={isEdit ? "Edit automation" : "New automation"}
      footer={
        <>
          <button type="button" className={secondaryButtonClass} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => void handleSave()}
            disabled={saving || !canSave}
          >
            {saving ? "Saving…" : "Save Automation"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-stone-900">Basic Information</h3>

          <label className="block text-sm">
            <span className="font-medium text-stone-800">Occasion</span>
            {isEdit ? (
              <p className="mt-1 text-sm text-stone-700">{occasionLabel}</p>
            ) : (
              <select
                className={`${inputClass} mt-1`}
                value={occasionId}
                onChange={(event) => setOccasionId(event.target.value)}
              >
                {occasions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="block text-sm">
            <span className="font-medium text-stone-800">Category</span>
            {isEdit ? (
              <p className="mt-1 text-sm text-stone-700">{categoryName}</p>
            ) : (
              <div className="mt-1">
                <CategoryMultiSelect
                  categories={categories}
                  selectedCategories={selectedCategories}
                  onChange={(nextCategories) => {
                    setCategoryIds(nextCategories.map((category) => category.id));
                    setChannelForm(emptyChannelForm());
                    setPreviews({});
                  }}
                  label="Selected Categories"
                />
              </div>
            )}
          </label>

          {alreadyConfigured ? (
            <InlineAlert tone="warning">
              One or more selected categories already has a {occasionLabel} automation.
              Edit the existing automation instead of creating a new one.
            </InlineAlert>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-stone-200 pt-4">
          <h3 className="text-sm font-semibold text-stone-900">Delivery Channels</h3>

          {CHANNELS.map((channel) => {
            const state = channelForm[channel];
            const providerStatus =
              channel === "SMS" ? channelStatus.sms : channel === "WHATSAPP" ? channelStatus.whatsapp : null;
            const providerConnected = providerStatus ? providerStatus.configured && providerStatus.isActive : null;
            const templates = eligibleTemplatesFor(channel);
            const preview = previews[channel];

            return (
              <div
                key={channel}
                className="rounded-lg border border-stone-200 p-3"
              >
                <label className="flex items-center gap-2 text-sm font-medium text-stone-800">
                  <input
                    type="checkbox"
                    checked={state.enabled}
                    onChange={(event) => toggleChannel(channel, event.target.checked)}
                    disabled={categoryIds.length === 0}
                  />
                  {CHANNEL_LABEL[channel]}
                </label>

                {state.enabled ? (
                  <div className="mt-3 flex flex-col gap-3 pl-6">
                    {channel === "EMAIL" ? (
                      <p className="text-xs text-stone-500">
                        Email Service: sent automatically through the platform&apos;s email
                        provider - no setup needed.
                      </p>
                    ) : (
                      <p className="text-xs text-stone-500">
                        {channel === "WHATSAPP" ? "Business Account" : "SMS Provider"}:{" "}
                        {providerConnected === null ? (
                          "Checking…"
                        ) : providerConnected ? (
                          <span className="font-medium text-emerald-700">Connected</span>
                        ) : (
                          <>
                            <span className="font-medium text-amber-700">Not connected</span> -{" "}
                            <Link
                              href="/dashboard/settings/channels"
                              className="font-medium text-primary hover:underline"
                            >
                              set up in Settings
                            </Link>
                          </>
                        )}
                      </p>
                    )}

                    <label className="block text-sm">
                      <span className="text-xs font-medium text-stone-700">Approved Template</span>
                      <select
                        className={`${inputClass} mt-1`}
                        value={state.templateId}
                        onChange={(event) => setChannelTemplate(channel, event.target.value)}
                      >
                        <option value="">Choose a template</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                      {templates.length === 0 ? (
                        <span className="mt-1 block text-xs text-stone-500">
                          No approved {CHANNEL_LABEL[channel]} templates for the selected categories yet.
                        </span>
                      ) : null}
                    </label>

                    {previewLoading === channel ? (
                      <p className="text-xs text-stone-500">Loading preview…</p>
                    ) : preview ? (
                      <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                        {preview.emailSubject ? (
                          <p className="text-xs font-medium text-stone-700">{preview.emailSubject}</p>
                        ) : null}
                        <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">
                          {preview.previewMessage}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}

          <Link
            href="/dashboard/templates"
            className="text-xs font-medium text-primary hover:underline"
          >
            Manage Templates
          </Link>
        </div>

        <div className="flex flex-col gap-3 border-t border-stone-200 pt-4">
          <h3 className="text-sm font-semibold text-stone-900">Schedule</h3>

          <label className="block text-sm">
            <span className="font-medium text-stone-800">Send Time</span>
            <input
              type="time"
              className={`${inputClass} mt-1`}
              value={sendTime}
              onChange={(event) => setSendTime(event.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-stone-800">Timezone</span>
            <p className="mt-1 text-sm text-stone-700">India Standard Time (IST)</p>
          </label>
        </div>

        <div className="flex flex-col gap-2 border-t border-stone-200 pt-4">
          <h3 className="text-sm font-semibold text-stone-900">Review</h3>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
            <dt className="text-xs text-stone-500">Automation</dt>
            <dd className="text-right text-sm font-medium text-stone-800">
              {automationReviewLabel || "—"}
            </dd>
            <dt className="text-xs text-stone-500">Category</dt>
            <dd className="text-right text-sm font-medium text-stone-800">{categoryReviewLabel || "—"}</dd>
            <dt className="text-xs text-stone-500">Occasion</dt>
            <dd className="text-right text-sm font-medium text-stone-800">
              {occasionLabel}
            </dd>
            <dt className="text-xs text-stone-500">Send Time</dt>
            <dd className="text-right text-sm font-medium text-stone-800">
              {formatHhmmLabel(sendTime)}
            </dd>
            <dt className="col-span-2 text-xs text-stone-500">Channels</dt>
            <dd className="col-span-2 text-sm text-stone-800">
              {selectedChannels.length === 0 ? (
                "—"
              ) : (
                <ul className="flex flex-col gap-1">
                  {selectedChannels.map((channel) => (
                    <li key={channel} className="flex justify-between">
                      <span className="font-medium">{CHANNEL_LABEL[channel]}</span>
                      <span className="text-stone-600">
                        {eligibleTemplatesFor(channel).find((t) => t.id === channelForm[channel].templateId)
                          ?.name ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </dl>
        </div>
      </div>
    </Drawer>
  );
}
