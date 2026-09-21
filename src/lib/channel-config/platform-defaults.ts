import {
  Channel,
  ChannelProvider,
  type ChannelConfig,
} from "@prisma/client";

import { assertLiveCustomHttpAllowed } from "@/lib/abuse/live-channels";
import { encryptCredentials } from "@/lib/crypto/credentials";
import { prisma } from "@/lib/db";

import { buildSmsHttpSettings } from "./resolve";

export type PlatformDefaultSms = {
  baseUrl: string;
  sendPath: string;
  route: string;
  senderId: string;
  username: string;
  password: string;
};

const PLATFORM_DEFAULT_SMS_CONFIG_ID = "platform-default-sms";

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
    const allowed =
      env.NODE_ENV === "production" ? ["https:"] : ["http:", "https:"];
    if (!allowed.includes(url.protocol) || !sendPath.startsWith("/")) {
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
 * configured or the client isn't allowed live sending. The client must clear
 * the same live-send gate as configuring its own gateway (an active paid plan
 * or platform approval), so the platform never pays for unapproved free clients.
 */
export async function getPlatformDefaultSmsConfig(
  organizationId: string,
): Promise<ChannelConfig | null> {
  const sms = readPlatformDefaultSms();
  if (!sms) {
    return null;
  }

  try {
    await assertLiveCustomHttpAllowed({
      organizationId,
      provider: ChannelProvider.CUSTOM_HTTP,
    });
  } catch {
    return null;
  }

  return toChannelConfig(organizationId, sms);
}

/**
 * The gateway config to send a channel's messages with: the client's own when
 * it has one (inactive means the client turned the channel off, so no
 * fallback), otherwise - SMS only - the platform default.
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

  if (channel !== Channel.SMS) {
    return null;
  }

  return getPlatformDefaultSmsConfig(organizationId);
}
