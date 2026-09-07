import type { Channel } from "@prisma/client";

export type OrgCategory = {
  id: string;
  name: string;
};

export type AutomationChannelConfig = {
  channel: Channel;
  channelLabel: string;
  templateId: string;
  templateName: string;
};

export type AutomationStatus = "active" | "paused" | "disabled";

/** One card = one business rule (category + occasion), which can send through several channels. */
export type AutomationCardData = {
  key: string;
  occasionId: string;
  occasionLabel: string;
  categoryId: string;
  categoryName: string;
  title: string;
  sendHour: number;
  sendMinute: number;
  sendTimeLabel: string;
  channels: AutomationChannelConfig[];
  status: AutomationStatus;
  active: boolean;
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
};
