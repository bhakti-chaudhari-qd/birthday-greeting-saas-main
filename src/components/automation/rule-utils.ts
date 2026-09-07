import type { Channel } from "@prisma/client";

import type { CategoryAutomationRuleView } from "@/lib/automation/category-settings";

import { CHANNEL_LABEL, type AutomationCardData } from "./types";

export type RulePayload = {
  categoryId: string;
  sendHour: number | null;
  sendMinute: number | null;
  smsEnabled: boolean;
  smsTemplateId: string | null;
  whatsappEnabled: boolean;
  whatsappTemplateId: string | null;
  emailEnabled: boolean;
  emailTemplateId: string | null;
  callEnabled: boolean;
};

export type ChannelSelection = {
  channel: Channel;
  /** Checkbox state - is this channel part of the automation's configuration. */
  checked: boolean;
  templateId: string | null;
};

/** Strips a rule (view or partial override) down to the shape the save API accepts. */
export function toPayloadRule(rule: {
  categoryId: string;
  sendHour: number | null;
  sendMinute: number | null;
  smsEnabled: boolean;
  smsTemplateId: string | null;
  whatsappEnabled: boolean;
  whatsappTemplateId: string | null;
  emailEnabled: boolean;
  emailTemplateId: string | null;
  callEnabled?: boolean;
}): RulePayload {
  return {
    categoryId: rule.categoryId,
    sendHour: rule.sendHour,
    sendMinute: rule.sendMinute,
    smsEnabled: rule.smsEnabled,
    smsTemplateId: rule.smsTemplateId,
    whatsappEnabled: rule.whatsappEnabled,
    whatsappTemplateId: rule.whatsappTemplateId,
    emailEnabled: rule.emailEnabled,
    emailTemplateId: rule.emailTemplateId,
    callEnabled: rule.callEnabled ?? false,
  };
}

/**
 * Builds the full payload for one automation (all channels at once) from drawer form state.
 * `active` is the automation's overall Active/Paused status - saving edits to a paused
 * automation must not silently resume it, so `checked` (channel membership) and the actual
 * send-enabled flag are tracked separately.
 */
export function buildRulePayload(
  categoryId: string,
  sendHour: number,
  sendMinute: number,
  channels: ChannelSelection[],
  active: boolean,
): RulePayload {
  const byChannel = new Map(channels.map((c) => [c.channel, c] as const));
  const sms = byChannel.get("SMS");
  const whatsapp = byChannel.get("WHATSAPP");
  const email = byChannel.get("EMAIL");

  return {
    categoryId,
    sendHour,
    sendMinute,
    smsEnabled: Boolean(sms?.checked && sms.templateId) && active,
    smsTemplateId: sms?.checked ? (sms.templateId ?? null) : null,
    whatsappEnabled: Boolean(whatsapp?.checked && whatsapp.templateId) && active,
    whatsappTemplateId: whatsapp?.checked ? (whatsapp.templateId ?? null) : null,
    emailEnabled: Boolean(email?.checked && email.templateId) && active,
    emailTemplateId: email?.checked ? (email.templateId ?? null) : null,
    callEnabled: false,
  };
}

/** Turns all currently-configured channels on a rule on/off together, keeping their templates. */
export function withAllChannelsToggled(
  rule: CategoryAutomationRuleView,
  enabled: boolean,
): RulePayload {
  return toPayloadRule({
    ...rule,
    smsEnabled: enabled && Boolean(rule.smsTemplateId),
    whatsappEnabled: enabled && Boolean(rule.whatsappTemplateId),
    emailEnabled: enabled && Boolean(rule.emailTemplateId),
  });
}

/** Clears every channel on a rule - the whole automation disappears from the list. */
export function withAllChannelsCleared(rule: CategoryAutomationRuleView): RulePayload {
  return toPayloadRule({
    ...rule,
    smsEnabled: false,
    smsTemplateId: null,
    whatsappEnabled: false,
    whatsappTemplateId: null,
    emailEnabled: false,
    emailTemplateId: null,
  });
}

function formatSendTimeLabel(sendHour: number, sendMinute: number): string {
  const period = sendHour >= 12 ? "PM" : "AM";
  const hour12 = sendHour % 12 === 0 ? 12 : sendHour % 12;
  return `${hour12}:${String(sendMinute).padStart(2, "0")} ${period}`;
}

function templateNameFor(
  channel: Channel,
  templateId: string,
  settings: {
    eligibleSmsTemplates: Array<{ id: string; name: string }>;
    eligibleWhatsAppTemplates: Array<{ id: string; name: string }>;
    eligibleEmailTemplates: Array<{ id: string; name: string }>;
  },
): string {
  const list =
    channel === "SMS"
      ? settings.eligibleSmsTemplates
      : channel === "WHATSAPP"
        ? settings.eligibleWhatsAppTemplates
        : settings.eligibleEmailTemplates;
  return list.find((template) => template.id === templateId)?.name ?? "Template unavailable";
}

function isConfiguredChannel(row: { templateId: string | null }) {
  return Boolean(row.templateId);
}

function isActiveChannel(row: { enabled: boolean; templateId: string | null }) {
  return row.enabled && isConfiguredChannel(row);
}

/** Flattens one occasion's category rules into one card per configured automation (category + occasion). */
export function buildAutomationCards(
  occasionId: string,
  occasionName: string,
  settings: {
    rules: CategoryAutomationRuleView[];
    eligibleSmsTemplates: Array<{ id: string; name: string }>;
    eligibleWhatsAppTemplates: Array<{ id: string; name: string }>;
    eligibleEmailTemplates: Array<{ id: string; name: string }>;
  },
): AutomationCardData[] {
  const cards: AutomationCardData[] = [];

  for (const rule of settings.rules) {
    if (rule.sendHour === null || rule.sendMinute === null) {
      continue;
    }

    const channelRows: Array<{
      channel: Channel;
      enabled: boolean;
      templateId: string | null;
    }> = [
      { channel: "WHATSAPP", enabled: rule.whatsappEnabled, templateId: rule.whatsappTemplateId },
      { channel: "EMAIL", enabled: rule.emailEnabled, templateId: rule.emailTemplateId },
      { channel: "SMS", enabled: rule.smsEnabled, templateId: rule.smsTemplateId },
    ];

    const hasSendTime = rule.sendHour !== null && rule.sendMinute !== null;
    const configuredRows = channelRows.filter(isConfiguredChannel);
    if (!hasSendTime && configuredRows.length === 0) {
      continue;
    }

    const active = configuredRows.some(isActiveChannel);
    const status = active ? "active" : configuredRows.length > 0 ? "paused" : "disabled";

    cards.push({
      key: `${occasionId}:${rule.categoryId}`,
      occasionId,
      occasionLabel: occasionName,
      categoryId: rule.categoryId,
      categoryName: rule.categoryName,
      title: `${rule.categoryName} ${occasionName}`,
      sendHour: rule.sendHour,
      sendMinute: rule.sendMinute,
      sendTimeLabel: formatSendTimeLabel(rule.sendHour, rule.sendMinute),
      channels: configuredRows.map((row) => ({
        channel: row.channel,
        channelLabel: CHANNEL_LABEL[row.channel],
        templateId: row.templateId!,
        templateName: templateNameFor(row.channel, row.templateId!, settings),
      })),
      status,
      active,
    });
  }

  return cards;
}
