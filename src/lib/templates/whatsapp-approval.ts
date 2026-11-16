import { Channel, ChannelProvider } from "@prisma/client";
import { z } from "zod";

import {
  WHATSAPP_META_DEFAULT_API_VERSION,
  whatsappMetaCredentialsSchema,
  whatsappMetaSettingsSchema,
} from "@/lib/channel-config/whatsapp-types";
import { decryptCredentials } from "@/lib/crypto/credentials";
import { prisma } from "@/lib/db";
import { MetaGraphError, metaGraphRequest } from "@/lib/messaging/meta-graph";

import { TemplateNotFoundError } from "./errors";

/** Why a template cannot be submitted or checked; `message` is shown as-is. */
export class WhatsAppApprovalError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_META"
      | "NO_BUSINESS_ACCOUNT"
      | "NOT_WHATSAPP"
      | "MEDIA_NOT_SUPPORTED"
      | "INVALID_TEXT"
      | "INVALID_NAME"
      | "NOT_SUBMITTED"
      | "META",
  ) {
    super(message);
    this.name = "WhatsAppApprovalError";
  }
}

export const WHATSAPP_APPROVAL_CATEGORIES = ["MARKETING", "UTILITY"] as const;
export type WhatsAppApprovalCategory = (typeof WHATSAPP_APPROVAL_CATEGORIES)[number];

export const submitWhatsAppApprovalSchema = z
  .object({ category: z.enum(WHATSAPP_APPROVAL_CATEGORIES) })
  .strict();

/** Example values Meta needs to review each {{n}} in the text. */
const EXAMPLE_VALUES: Record<string, string> = {
  name: "Asha",
  mobile: "9876543210",
  email: "asha@example.com",
  address: "Pune",
};
const EXAMPLE_FALLBACK = "Sample";

const META_BODY_MAX = 1024;
const PLACEHOLDER = /\{\{(\w+)\}\}/g;

export type MetaTemplateBody = {
  /** The text with each {{variable}} replaced by {{1}}, {{2}}, ... */
  text: string;
  /** Variable name for each {{n}}, in order - stored as whatsappParameterOrder. */
  parameterOrder: string[];
  /** Example value for each {{n}}, in order. */
  examples: string[];
};

/**
 * Converts the app's named placeholders to Meta's numbered ones ({{name}}
 * -> {{1}}, ...) and records which contact value fills each number. Throws
 * when Meta would reject the text or a placeholder is repeated.
 */
export function toMetaTemplateBody(body: string): MetaTemplateBody {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new WhatsAppApprovalError("Write the message text first", "INVALID_TEXT");
  }
  if (trimmed.length > META_BODY_MAX) {
    throw new WhatsAppApprovalError(
      `WhatsApp message text can be at most ${META_BODY_MAX} characters`,
      "INVALID_TEXT",
    );
  }
  if (/^\{\{\w+\}\}/.test(trimmed) || /\{\{\w+\}\}$/.test(trimmed)) {
    throw new WhatsAppApprovalError(
      "Meta does not allow the message to start or end with a {{placeholder}}. Add words around it, e.g. \"Happy birthday, {{name}}!\"",
      "INVALID_TEXT",
    );
  }
  if (/\}\}\s*\{\{/.test(trimmed)) {
    throw new WhatsAppApprovalError(
      "Meta does not allow two placeholders next to each other. Put a word between them.",
      "INVALID_TEXT",
    );
  }

  // One number per placeholder, in order of appearance - the same order the
  // app uses to fill parameters when sending (each value is sent once).
  const parameterOrder: string[] = [];
  const text = trimmed.replace(PLACEHOLDER, (_match, variable: string) => {
    if (parameterOrder.includes(variable)) {
      throw new WhatsAppApprovalError(
        `Use each placeholder only once in a WhatsApp template - {{${variable}}} appears more than once.`,
        "INVALID_TEXT",
      );
    }
    parameterOrder.push(variable);
    return `{{${parameterOrder.length}}}`;
  });

  return {
    text,
    parameterOrder,
    examples: parameterOrder.map((variable) => EXAMPLE_VALUES[variable] ?? EXAMPLE_FALLBACK),
  };
}

/** Meta template names: lowercase letters, digits and underscores only. */
export function toMetaTemplateName(name: string): string {
  const candidate = name.trim().toLowerCase();
  if (!/^[a-z0-9_]{1,512}$/.test(candidate)) {
    throw new WhatsAppApprovalError(
      "The WhatsApp template name can only use letters, numbers and underscores (e.g. birthday_wish). Change it and save first.",
      "INVALID_NAME",
    );
  }
  return candidate;
}

type MetaAccount = {
  accessToken: string;
  apiVersion: string;
  businessAccountId: string | null;
};

/** The client's own Meta connection, or why there isn't a usable one. */
async function loadMetaAccount(
  organizationId: string,
): Promise<{ account: MetaAccount | null; provider: "META" | "OTHER" | "NONE" }> {
  const config = await prisma.channelConfig.findUnique({
    where: { organizationId_channel: { organizationId, channel: Channel.WHATSAPP } },
  });
  if (!config) {
    return { account: null, provider: "NONE" };
  }
  if (config.provider !== ChannelProvider.META) {
    return { account: null, provider: "OTHER" };
  }
  try {
    const credentials = whatsappMetaCredentialsSchema.parse(
      JSON.parse(decryptCredentials(config.encryptedCredentials)),
    );
    const settings = whatsappMetaSettingsSchema.parse(config.settings ?? {});
    return {
      provider: "META",
      account: {
        accessToken: credentials.accessToken,
        apiVersion: settings.apiVersion ?? WHATSAPP_META_DEFAULT_API_VERSION,
        businessAccountId: settings.businessAccountId ?? null,
      },
    };
  } catch {
    return { account: null, provider: "META" };
  }
}

async function requireMetaAccount(organizationId: string): Promise<MetaAccount> {
  const { account } = await loadMetaAccount(organizationId);
  if (!account) {
    throw new WhatsAppApprovalError(
      "Submitting templates from the app needs your own Meta WhatsApp connection. Set it up under Settings → Channels → WhatsApp.",
      "NOT_META",
    );
  }
  return account;
}

async function loadWhatsAppTemplate(organizationId: string, templateId: string) {
  const template = await prisma.messageTemplate.findFirst({
    where: { id: templateId, organizationId },
  });
  if (!template) {
    throw new TemplateNotFoundError();
  }
  if (template.channel !== Channel.WHATSAPP) {
    throw new WhatsAppApprovalError("Only WhatsApp templates need Meta approval", "NOT_WHATSAPP");
  }
  return template;
}

export type WhatsAppApprovalView = {
  /**
   * Meta's APPROVED, PENDING, REJECTED, PAUSED, DISABLED; EDITED when the
   * text changed after submitting; null when never submitted or checked.
   */
  status: string | null;
  category: string | null;
  rejectedReason: string | null;
  submittedAt: string | null;
  checkedAt: string | null;
  templateName: string | null;
  language: string;
  /** What the client's WhatsApp connection allows. */
  connection: "META_READY" | "META_NEEDS_BUSINESS_ACCOUNT" | "NOT_META" | "NONE";
  /** Image/video templates must still be created in WhatsApp Manager. */
  hasMedia: boolean;
};

function toView(
  template: Awaited<ReturnType<typeof loadWhatsAppTemplate>>,
  connection: WhatsAppApprovalView["connection"],
): WhatsAppApprovalView {
  return {
    status: template.whatsappApprovalStatus,
    category: template.whatsappApprovalCategory,
    rejectedReason: template.whatsappRejectedReason,
    submittedAt: template.whatsappSubmittedAt?.toISOString() ?? null,
    checkedAt: template.whatsappStatusCheckedAt?.toISOString() ?? null,
    templateName: template.whatsappTemplateName,
    language: template.whatsappLanguage ?? "en",
    connection,
    hasMedia: Boolean(template.whatsappMediaAssetId),
  };
}

async function connectionOf(
  organizationId: string,
): Promise<WhatsAppApprovalView["connection"]> {
  const { account, provider } = await loadMetaAccount(organizationId);
  if (provider === "NONE") return "NONE";
  if (provider === "OTHER") return "NOT_META";
  if (!account) return "NOT_META";
  return account.businessAccountId ? "META_READY" : "META_NEEDS_BUSINESS_ACCOUNT";
}

/** The stored approval state, without calling Meta. */
export async function getWhatsAppApproval(
  organizationId: string,
  templateId: string,
): Promise<WhatsAppApprovalView> {
  const template = await loadWhatsAppTemplate(organizationId, templateId);
  return toView(template, await connectionOf(organizationId));
}

function rethrowMeta(error: unknown): never {
  if (error instanceof MetaGraphError) {
    throw new WhatsAppApprovalError(error.message, "META");
  }
  throw error;
}

/**
 * Submits the saved WhatsApp template to Meta for approval with the
 * client's own account. A template Meta rejected or paused is edited in
 * place (same name); anything else is created new. Saves the Meta template
 * ID, the parameter order and PENDING (or Meta's status).
 */
export async function submitWhatsAppTemplateForApproval(
  organizationId: string,
  templateId: string,
  category: WhatsAppApprovalCategory,
): Promise<WhatsAppApprovalView> {
  const template = await loadWhatsAppTemplate(organizationId, templateId);
  const account = await requireMetaAccount(organizationId);
  if (!account.businessAccountId) {
    throw new WhatsAppApprovalError(
      "Add your WhatsApp Business Account ID under Settings → Channels → WhatsApp first.",
      "NO_BUSINESS_ACCOUNT",
    );
  }
  if (template.whatsappMediaAssetId) {
    throw new WhatsAppApprovalError(
      "Templates with an image or video can't be submitted from the app yet. Remove the media to submit a text template, or create this one in WhatsApp Manager.",
      "MEDIA_NOT_SUPPORTED",
    );
  }

  const name = toMetaTemplateName(template.whatsappTemplateName ?? "");
  const language = template.whatsappLanguage ?? "en";
  const body = toMetaTemplateBody(template.body);
  const components = [
    {
      type: "BODY",
      text: body.text,
      ...(body.examples.length > 0 ? { example: { body_text: [body.examples] } } : {}),
    },
  ];

  const base = `https://graph.facebook.com/${account.apiVersion}`;
  // Rejected, paused or edited-since-approval templates already exist in
  // Meta under this name, so they are edited in place (same name, same ID).
  const editInPlace =
    Boolean(template.whatsappProviderTemplateId) &&
    (template.whatsappApprovalStatus === "REJECTED" ||
      template.whatsappApprovalStatus === "PAUSED" ||
      template.whatsappApprovalStatus === "EDITED");

  let metaId = template.whatsappProviderTemplateId;
  let status = "PENDING";
  let assignedCategory: string = category;
  try {
    if (editInPlace) {
      await metaGraphRequest(`${base}/${template.whatsappProviderTemplateId}`, account.accessToken, {
        method: "POST",
        body: { category, components },
      });
    } else {
      const result = await metaGraphRequest(
        `${base}/${account.businessAccountId}/message_templates`,
        account.accessToken,
        { method: "POST", body: { name, language, category, components } },
      );
      metaId = typeof result.id === "string" ? result.id : metaId;
      status = typeof result.status === "string" ? result.status : status;
      assignedCategory =
        typeof result.category === "string" ? result.category : assignedCategory;
    }
  } catch (error) {
    rethrowMeta(error);
  }

  const now = new Date();
  const updated = await prisma.messageTemplate.update({
    where: { id: template.id },
    data: {
      whatsappTemplateName: name,
      whatsappProviderTemplateId: metaId,
      whatsappParameterOrder: body.parameterOrder,
      whatsappApprovalStatus: status,
      whatsappApprovalCategory: assignedCategory,
      whatsappRejectedReason: null,
      whatsappSubmittedAt: now,
      whatsappStatusCheckedAt: now,
    },
  });
  return toView(updated, "META_READY");
}

type MetaTemplateRow = {
  id?: string;
  name?: string;
  language?: string;
  status?: string;
  category?: string;
  rejected_reason?: string;
};

/**
 * Asks Meta for the template's current status (by its Meta template ID,
 * else by name + language) and saves it. Works for templates created in
 * WhatsApp Manager too, as long as the name or ID matches.
 */
export async function refreshWhatsAppApproval(
  organizationId: string,
  templateId: string,
): Promise<WhatsAppApprovalView> {
  const template = await loadWhatsAppTemplate(organizationId, templateId);
  const account = await requireMetaAccount(organizationId);
  const base = `https://graph.facebook.com/${account.apiVersion}`;
  const fields = "id,name,language,status,category,rejected_reason";
  const language = template.whatsappLanguage ?? "en";

  let row: MetaTemplateRow | undefined;
  try {
    if (template.whatsappProviderTemplateId) {
      row = (await metaGraphRequest(
        `${base}/${template.whatsappProviderTemplateId}?fields=${fields}`,
        account.accessToken,
        { method: "GET" },
      )) as MetaTemplateRow;
    } else if (account.businessAccountId && template.whatsappTemplateName) {
      const params = new URLSearchParams({ name: template.whatsappTemplateName, fields });
      const result = await metaGraphRequest(
        `${base}/${account.businessAccountId}/message_templates?${params}`,
        account.accessToken,
        { method: "GET" },
      );
      const rows = (Array.isArray(result.data) ? result.data : []) as MetaTemplateRow[];
      // Meta's name filter is a "contains" match, so pick the exact one.
      row = rows.find(
        (entry) => entry.name === template.whatsappTemplateName && entry.language === language,
      );
    } else {
      throw new WhatsAppApprovalError(
        account.businessAccountId
          ? "Add the WhatsApp template name first"
          : "Add your WhatsApp Business Account ID under Settings → Channels → WhatsApp first.",
        account.businessAccountId ? "NOT_SUBMITTED" : "NO_BUSINESS_ACCOUNT",
      );
    }
  } catch (error) {
    rethrowMeta(error);
  }

  if (!row) {
    throw new WhatsAppApprovalError(
      `Meta has no template named "${template.whatsappTemplateName}" in language ${language}. Submit it for approval first.`,
      "NOT_SUBMITTED",
    );
  }

  const updated = await prisma.messageTemplate.update({
    where: { id: template.id },
    data: {
      whatsappApprovalStatus: row.status ?? null,
      whatsappApprovalCategory: row.category ?? null,
      whatsappRejectedReason:
        row.rejected_reason && row.rejected_reason !== "NONE" ? row.rejected_reason : null,
      whatsappStatusCheckedAt: new Date(),
      ...(row.id && !template.whatsappProviderTemplateId
        ? { whatsappProviderTemplateId: row.id }
        : {}),
    },
  });
  return toView(updated, await connectionOf(organizationId));
}
