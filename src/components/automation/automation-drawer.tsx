"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Channel } from "@prisma/client";

import { useOccasions } from "@/components/occasions/use-occasions";
import { Drawer } from "@/components/ui/drawer";
import { InlineAlert } from "@/components/ui/feedback";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/page";
import type { CategoryAutomationSettingsView } from "@/lib/automation/category-settings";
import { getGreetingRoutesDict } from "@/lib/i18n/dictionaries/greeting-routes";
import { useLocale } from "@/lib/i18n/use-locale";

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

function formatHhmmLabel(hhmm: string, notSetLabel: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) {
    return notSetLabel;
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
  const dict = getGreetingRoutesDict(useLocale()).drawer;
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
          sms: smsRes.ok
            ? smsBody.data?.usingPlatformDefault
              ? { configured: true, isActive: true }
              : { configured: smsBody.data?.configured, isActive: smsBody.data?.isActive }
            : null,
          whatsapp: waRes.ok
            ? waBody.data?.usingPlatformDefault
              ? { configured: true, isActive: true }
              : { configured: waBody.data?.configured, isActive: waBody.data?.isActive }
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
          ? dict.categoriesCount(selectedCategories.length)
          : "",
    [selectedCategories, dict],
  );
  const categoryReviewLabel = useMemo(
    () =>
      selectedCategories.length === 1
        ? selectedCategories[0]!.name
        : selectedCategories.length > 1
          ? dict.categoriesCountCaps(selectedCategories.length)
          : "",
    [selectedCategories, dict],
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
      setError(dict.errorChooseCategory);
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
        setError(body.error?.message ?? dict.errorSaveGeneric);
        return;
      }

      await onSaved(occasionId);
      onClose();
    } catch {
      setError(dict.errorSaveConnection);
    } finally {
      setSaving(false);
    }
  }

  const title = isEdit ? `${categoryName} ${occasionLabel}` : dict.createTitle;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      description={isEdit ? dict.editDescription : dict.createDescription}
      footer={
        <>
          <button type="button" className={secondaryButtonClass} onClick={onClose} disabled={saving}>
            {dict.cancel}
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => void handleSave()}
            disabled={saving || !canSave}
          >
            {saving ? dict.saving : dict.save}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-stone-900">{dict.basicInformation}</h3>

          <label className="block text-sm">
            <span className="font-medium text-stone-800">{dict.occasion}</span>
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
            <span className="font-medium text-stone-800">{dict.category}</span>
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
                  label={dict.selectedCategoriesLabel}
                />
              </div>
            )}
          </label>

          {alreadyConfigured ? (
            <InlineAlert tone="warning">
              {dict.alreadyConfiguredWarning(occasionLabel)}
            </InlineAlert>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-stone-200 pt-4">
          <h3 className="text-sm font-semibold text-stone-900">{dict.deliveryChannels}</h3>

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
                        {dict.emailServiceNote}
                      </p>
                    ) : (
                      <p className="text-xs text-stone-500">
                        {channel === "WHATSAPP" ? dict.businessAccount : dict.smsProvider}:{" "}
                        {providerConnected === null ? (
                          dict.checking
                        ) : providerConnected ? (
                          <span className="font-medium text-emerald-700">{dict.connected}</span>
                        ) : (
                          <>
                            <span className="font-medium text-amber-700">{dict.notConnected}</span> -{" "}
                            <Link
                              href="/dashboard/settings/channels"
                              className="font-medium text-primary hover:underline"
                            >
                              {dict.setUpInSettings}
                            </Link>
                          </>
                        )}
                      </p>
                    )}

                    <label className="block text-sm">
                      <span className="text-xs font-medium text-stone-700">{dict.approvedTemplate}</span>
                      <select
                        className={`${inputClass} mt-1`}
                        value={state.templateId}
                        onChange={(event) => setChannelTemplate(channel, event.target.value)}
                      >
                        <option value="">{dict.chooseTemplate}</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                      {templates.length === 0 ? (
                        <span className="mt-1 block text-xs text-stone-500">
                          {dict.noApprovedTemplates(CHANNEL_LABEL[channel])}
                        </span>
                      ) : null}
                    </label>

                    {previewLoading === channel ? (
                      <p className="text-xs text-stone-500">{dict.loadingPreview}</p>
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
            {dict.manageTemplates}
          </Link>
        </div>

        <div className="flex flex-col gap-3 border-t border-stone-200 pt-4">
          <h3 className="text-sm font-semibold text-stone-900">{dict.schedule}</h3>

          <label className="block text-sm">
            <span className="font-medium text-stone-800">{dict.sendTimeLabel}</span>
            <input
              type="time"
              className={`${inputClass} mt-1`}
              value={sendTime}
              onChange={(event) => setSendTime(event.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-stone-800">{dict.timezone}</span>
            <p className="mt-1 text-sm text-stone-700">{dict.timezoneValue}</p>
          </label>
        </div>

        <div className="flex flex-col gap-2 border-t border-stone-200 pt-4">
          <h3 className="text-sm font-semibold text-stone-900">{dict.review}</h3>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
            <dt className="text-xs text-stone-500">{dict.automation}</dt>
            <dd className="text-right text-sm font-medium text-stone-800">
              {automationReviewLabel || dict.dash}
            </dd>
            <dt className="text-xs text-stone-500">{dict.category}</dt>
            <dd className="text-right text-sm font-medium text-stone-800">{categoryReviewLabel || dict.dash}</dd>
            <dt className="text-xs text-stone-500">{dict.occasion}</dt>
            <dd className="text-right text-sm font-medium text-stone-800">
              {occasionLabel}
            </dd>
            <dt className="text-xs text-stone-500">{dict.sendTimeLabel}</dt>
            <dd className="text-right text-sm font-medium text-stone-800">
              {formatHhmmLabel(sendTime, dict.notSet)}
            </dd>
            <dt className="col-span-2 text-xs text-stone-500">{dict.channelsLabel}</dt>
            <dd className="col-span-2 text-sm text-stone-800">
              {selectedChannels.length === 0 ? (
                dict.dash
              ) : (
                <ul className="flex flex-col gap-1">
                  {selectedChannels.map((channel) => (
                    <li key={channel} className="flex justify-between">
                      <span className="font-medium">{CHANNEL_LABEL[channel]}</span>
                      <span className="text-stone-600">
                        {eligibleTemplatesFor(channel).find((t) => t.id === channelForm[channel].templateId)
                          ?.name ?? dict.dash}
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
