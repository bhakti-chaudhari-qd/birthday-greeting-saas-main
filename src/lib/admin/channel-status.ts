import { Channel, ChannelProvider } from "@prisma/client";

import { getEmailChannelConfig } from "@/lib/channel-config/email-service";
import { getSmsChannelConfig } from "@/lib/channel-config/service";
import { resolveWhatsAppMetaProviderConfig } from "@/lib/channel-config/whatsapp-resolve";
import { getWhatsAppChannelConfig } from "@/lib/channel-config/whatsapp-service";
import { prisma } from "@/lib/db";
import {
  getCustomerEmailProviderLabel,
  getCustomerSmsProviderLabel,
  getCustomerWhatsAppProviderLabel,
} from "@/lib/ui/customer-labels";

import { PlatformAdminOrgError } from "./org-ops";

export type PlatformChannelSource = "own" | "platform_default" | "none";

export type PlatformChannelStatus = {
  channel: "SMS" | "WHATSAPP" | "EMAIL";
  /** Whose gateway this client's messages go through on this channel. */
  source: PlatformChannelSource;
  /** Gateway name, e.g. "Meta Cloud API". Null when nothing is set up. */
  gateway: string | null;
  /** False when the client saved a gateway and then switched it off. */
  isActive: boolean;
  /** A non-secret identifier: gateway host, phone number ID or from address. */
  detail: string | null;
  /** True when a live health check against the provider is available. */
  healthCheckSupported: boolean;
};

function hostOf(baseUrl: string | undefined): string | null {
  if (!baseUrl) {
    return null;
  }
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

/** Which gateway each channel uses for this client - no credentials included. */
export async function getChannelStatusesForPlatformAdmin(
  organizationId: string,
): Promise<PlatformChannelStatus[]> {
  const [sms, whatsapp, email] = await Promise.all([
    getSmsChannelConfig(organizationId),
    getWhatsAppChannelConfig(organizationId),
    getEmailChannelConfig(organizationId),
  ]);

  const smsStatus: PlatformChannelStatus = sms.configured
    ? {
        channel: "SMS",
        source: "own",
        gateway: getCustomerSmsProviderLabel(sms.provider),
        isActive: sms.isActive,
        detail:
          [hostOf(sms.baseUrl), sms.senderId].filter(Boolean).join(" · ") || null,
        healthCheckSupported: false,
      }
    : {
        channel: "SMS",
        source: sms.usingPlatformDefault ? "platform_default" : "none",
        gateway: null,
        isActive: Boolean(sms.usingPlatformDefault),
        detail: null,
        healthCheckSupported: false,
      };

  const whatsappStatus: PlatformChannelStatus = whatsapp.configured
    ? {
        channel: "WHATSAPP",
        source: "own",
        gateway: getCustomerWhatsAppProviderLabel(
          whatsapp.apiFormat === "KOVERAGE" ? "KOVERAGE" : whatsapp.provider,
        ),
        isActive: whatsapp.isActive,
        detail:
          whatsapp.provider === ChannelProvider.META
            ? (whatsapp.phoneNumberId ?? null)
            : hostOf(whatsapp.baseUrl),
        healthCheckSupported:
          whatsapp.provider === ChannelProvider.META && whatsapp.isActive,
      }
    : {
        channel: "WHATSAPP",
        source: whatsapp.usingPlatformDefault ? "platform_default" : "none",
        gateway: null,
        isActive: Boolean(whatsapp.usingPlatformDefault),
        detail: null,
        healthCheckSupported: false,
      };

  const emailStatus: PlatformChannelStatus = email.configured
    ? {
        channel: "EMAIL",
        source: "own",
        gateway: getCustomerEmailProviderLabel(email.provider),
        isActive: email.isActive,
        detail: email.fromEmail ?? null,
        healthCheckSupported: false,
      }
    : {
        channel: "EMAIL",
        source: email.platformDefaultFrom ? "platform_default" : "none",
        gateway: null,
        isActive: Boolean(email.platformDefaultFrom),
        detail: email.platformDefaultFrom ?? null,
        healthCheckSupported: false,
      };

  return [whatsappStatus, smsStatus, emailStatus];
}

export type MetaWhatsAppHealth = {
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  /** e.g. CONNECTED, PENDING */
  numberStatus: string | null;
  /** e.g. APPROVED */
  nameStatus: string | null;
  qualityRating: string | null;
  /** LIVE or SANDBOX (a test number that only reaches allow-listed phones). */
  accountMode: string | null;
  /** AVAILABLE, LIMITED or BLOCKED. */
  canSendMessage: string | null;
  /** Meta's own description of whatever is limiting or blocking sending. */
  issues: string[];
};

type MetaHealthEntity = {
  entity_type?: unknown;
  can_send_message?: unknown;
  errors?: Array<{ error_description?: unknown; possible_solution?: unknown }>;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Reduces Meta's phone-number health payload to what explains a failed send.
 * Only entities that cannot send contribute issues, which leaves out
 * unrelated noise such as calling/SIP errors on an otherwise healthy number.
 */
export function summarizeMetaWhatsAppHealth(
  payload: Record<string, unknown>,
): MetaWhatsAppHealth {
  const health = (payload.health_status ?? {}) as {
    can_send_message?: unknown;
    entities?: MetaHealthEntity[];
  };
  const issues: string[] = [];

  for (const entity of Array.isArray(health.entities) ? health.entities : []) {
    const canSend = text(entity.can_send_message);
    if (!canSend || canSend === "AVAILABLE") {
      continue;
    }
    for (const error of Array.isArray(entity.errors) ? entity.errors : []) {
      const description = text(error.error_description);
      if (description) {
        const solution = text(error.possible_solution);
        issues.push(solution ? `${description} ${solution}` : description);
      }
    }
  }

  return {
    displayPhoneNumber: text(payload.display_phone_number),
    verifiedName: text(payload.verified_name),
    numberStatus: text(payload.status),
    nameStatus: text(payload.name_status),
    qualityRating: text(payload.quality_rating),
    accountMode: text(payload.account_mode),
    canSendMessage: text(health.can_send_message),
    issues,
  };
}

const META_HEALTH_FIELDS =
  "display_phone_number,verified_name,status,name_status,quality_rating,account_mode,health_status";

/**
 * Asks Meta whether this client's WhatsApp number can send right now. A send
 * can be accepted and still fail later (e.g. no payment method), and this is
 * where the reason shows up.
 */
export async function checkMetaWhatsAppHealthForPlatformAdmin(
  organizationId: string,
  options: { fetchFn?: typeof fetch } = {},
): Promise<MetaWhatsAppHealth> {
  const config = await prisma.channelConfig.findUnique({
    where: {
      organizationId_channel: { organizationId, channel: Channel.WHATSAPP },
    },
  });

  if (!config || config.provider !== ChannelProvider.META) {
    throw new PlatformAdminOrgError(
      "This client does not use the Meta Cloud API WhatsApp gateway",
    );
  }

  const resolved = resolveWhatsAppMetaProviderConfig(config);
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(
    `https://graph.facebook.com/${resolved.apiVersion}/${resolved.phoneNumberId}?fields=${META_HEALTH_FIELDS}`,
    { headers: { Authorization: `Bearer ${resolved.accessToken}` } },
  );
  const payload = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!response.ok || !payload) {
    const message = text(
      (payload?.error as { message?: unknown } | undefined)?.message,
    );
    throw new PlatformAdminOrgError(
      message ?? `Meta returned an error (${response.status})`,
    );
  }

  return summarizeMetaWhatsAppHealth(payload);
}
