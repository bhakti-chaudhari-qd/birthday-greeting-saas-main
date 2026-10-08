import {
  Channel,
  ChannelProvider,
  type ChannelConfig,
} from "@prisma/client";

import { encryptCredentials } from "@/lib/crypto/credentials";
import { prisma } from "@/lib/db";

import { buildSmsHttpSettings } from "./resolve";
import { buildWhatsAppHttpSettings } from "./whatsapp-resolve";

export type PlatformDefaultSms = {
  baseUrl: string;
  sendPath: string;
  route: string;
  senderId: string;
  username: string;
  password: string;
};

const PLATFORM_DEFAULT_SMS_CONFIG_ID = "platform-default-sms";

export type PlatformDefaultWhatsApp = {
  baseUrl: string;
  sendPath: string;
  apiToken: string;
};

const PLATFORM_DEFAULT_WHATSAPP_CONFIG_ID = "platform-default-whatsapp";
const KOVERAGE_DEFAULT_BASE_URL = "https://waba.koverage.in";

function value(raw: string | undefined): string {
  return raw?.trim() ?? "";
}

/**
 * The platform's own SMS gateway, offered to clients that haven't configured
 * one. Configured through DEFAULT_SMS_* env vars; returns null (feature off)
 * unless every one is present and valid. Independent of PLATFORM_SMS_*, which
 * is only the vendor-invitation gateway.
 */
export function readPlatformDefaultSms(
  env: NodeJS.ProcessEnv = process.env,
): PlatformDefaultSms | null {
  const baseUrl = value(env.DEFAULT_SMS_BASE_URL);
  const sendPath = value(env.DEFAULT_SMS_SEND_PATH);
  const username = value(env.DEFAULT_SMS_USERNAME);
  const password = env.DEFAULT_SMS_PASSWORD ?? "";
  const route = value(env.DEFAULT_SMS_ROUTE);
  const senderId = value(env.DEFAULT_SMS_SENDER_ID);

  if (!baseUrl || !sendPath || !username || !password || !route || !senderId) {
    return null;
  }

  try {
    const url = new URL(baseUrl);
    // Plain http is accepted, as it is for a client's own SMS gateway: many
    // SMS providers offer no https endpoint.
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !sendPath.startsWith("/")
    ) {
      return null;
    }
    // Reuse the same validation a client's own SMS settings go through.
    buildSmsHttpSettings(baseUrl, sendPath, route, senderId);
  } catch {
    return null;
  }

  return { baseUrl, sendPath, route, senderId, username, password };
}

/**
 * In-memory ChannelConfig (never stored) so every existing send path treats
 * the platform default exactly like a client's own Custom HTTP gateway.
 */
function toChannelConfig(
  organizationId: string,
  sms: PlatformDefaultSms,
): ChannelConfig {
  return {
    id: PLATFORM_DEFAULT_SMS_CONFIG_ID,
    organizationId,
    channel: Channel.SMS,
    provider: ChannelProvider.CUSTOM_HTTP,
    encryptedCredentials: encryptCredentials(
      JSON.stringify({ username: sms.username, password: sms.password }),
    ),
    settings: buildSmsHttpSettings(
      sms.baseUrl,
      sms.sendPath,
      sms.route,
      sms.senderId,
    ),
    isActive: true,
    vendorId: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

/**
 * The platform default SMS gateway for this client, or null when it isn't
 * configured. Every client gets it from registration onward, on any plan,
 * until it saves a gateway of its own; the plan's monthly message limit is
 * what bounds how much a free client can send through it.
 */
export async function getPlatformDefaultSmsConfig(
  organizationId: string,
): Promise<ChannelConfig | null> {
  const sms = readPlatformDefaultSms();
  if (!sms) {
    return null;
  }

  return toChannelConfig(organizationId, sms);
}

/**
 * The platform's own Koverage WhatsApp account, offered to clients that
 * haven't configured a WhatsApp gateway. Configured through
 * DEFAULT_WHATSAPP_KOVERAGE_* env vars; returns null (feature off) unless the
 * vendor UID and API token are both present.
 */
export function readPlatformDefaultWhatsApp(
  env: NodeJS.ProcessEnv = process.env,
): PlatformDefaultWhatsApp | null {
  const vendorUid = value(env.DEFAULT_WHATSAPP_KOVERAGE_VENDOR_UID);
  const apiToken = value(env.DEFAULT_WHATSAPP_KOVERAGE_API_TOKEN);
  const baseUrl =
    value(env.DEFAULT_WHATSAPP_KOVERAGE_BASE_URL) || KOVERAGE_DEFAULT_BASE_URL;

  if (!vendorUid || !apiToken) {
    return null;
  }

  const sendPath = `/api/${encodeURIComponent(vendorUid)}/contact/send-template-message`;

  try {
    if (new URL(baseUrl).protocol !== "https:") {
      return null;
    }
    buildWhatsAppHttpSettings(baseUrl, sendPath, null, false, "KOVERAGE");
  } catch {
    return null;
  }

  return { baseUrl, sendPath, apiToken };
}

/** In-memory ChannelConfig (never stored), same idea as the SMS default. */
function toWhatsAppChannelConfig(
  organizationId: string,
  whatsapp: PlatformDefaultWhatsApp,
): ChannelConfig {
  return {
    id: PLATFORM_DEFAULT_WHATSAPP_CONFIG_ID,
    organizationId,
    channel: Channel.WHATSAPP,
    provider: ChannelProvider.CUSTOM_HTTP,
    encryptedCredentials: encryptCredentials(
      JSON.stringify({ apiKey: whatsapp.apiToken, password: "" }),
    ),
    settings: buildWhatsAppHttpSettings(
      whatsapp.baseUrl,
      whatsapp.sendPath,
      null,
      false,
      "KOVERAGE",
    ),
    isActive: true,
    vendorId: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

/**
 * The platform default WhatsApp gateway for this client, or null when it
 * isn't configured. Like the SMS default, every client gets it from
 * registration onward until it saves a gateway of its own.
 */
export async function getPlatformDefaultWhatsAppConfig(
  organizationId: string,
): Promise<ChannelConfig | null> {
  const whatsapp = readPlatformDefaultWhatsApp();
  if (!whatsapp) {
    return null;
  }

  return toWhatsAppChannelConfig(organizationId, whatsapp);
}

/**
 * The gateway config to send a channel's messages with: the client's own when
 * it has one (inactive means the client turned the channel off, so no
 * fallback), otherwise the platform default for SMS or WhatsApp.
 */
export async function getEffectiveChannelConfig(
  organizationId: string,
  channel: Channel,
): Promise<ChannelConfig | null> {
  const own = await prisma.channelConfig.findUnique({
    where: { organizationId_channel: { organizationId, channel } },
  });

  if (own) {
    return own.isActive ? own : null;
  }

  if (channel === Channel.SMS) {
    return getPlatformDefaultSmsConfig(organizationId);
  }

  if (channel === Channel.WHATSAPP) {
    return getPlatformDefaultWhatsAppConfig(organizationId);
  }

  return null;
}
