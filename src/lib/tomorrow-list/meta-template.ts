import { z } from "zod";

import { decryptCredentials } from "@/lib/crypto/credentials";
import { prisma } from "@/lib/db";

import { TOMORROW_LIST_SAMPLE_TOKEN } from "./service";

const CONFIG_ID = "default";
const META_REQUEST_TIMEOUT_MS = 15_000;

export const DEFAULT_TOMORROW_LIST_TEMPLATE_NAME = "tomorrow_list";
export const DEFAULT_TOMORROW_LIST_TEMPLATE_BODY =
  "Hello {{1}}, here is your greeting list for tomorrow, {{2}}. {{3}} people have an occasion. Tap the button below to view the list.";
export const DEFAULT_TOMORROW_LIST_BUTTON_TEXT = "View list";

/** Example values Meta needs to review the template body. */
const BODY_EXAMPLE = ["Sharma Clinic", "17 Nov 2026", "5"];

export class TomorrowListTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TomorrowListTemplateError";
  }
}

export const submitTomorrowListTemplateSchema = z
  .object({
    whatsappBusinessAccountId: z
      .string()
      .trim()
      .regex(/^\d{5,30}$/, "WhatsApp Business Account ID must be digits only"),
    templateName: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]{1,512}$/, "Template name uses lowercase letters, numbers and underscores"),
    language: z.string().trim().regex(/^[a-z]{2,3}(_[A-Z]{2})?$/, "Language looks like en or en_US"),
    body: z
      .string()
      .trim()
      .min(20, "Message text is too short")
      .max(1024, "Message text can be at most 1024 characters")
      .refine(
        (body) => ["{{1}}", "{{2}}", "{{3}}"].every((v) => body.split(v).length === 2),
        "Message text must contain {{1}}, {{2}} and {{3}} exactly once each",
      )
      .refine(
        (body) => !/\{\{(?![123]\}\})/.test(body),
        "Only {{1}}, {{2}} and {{3}} are allowed in the message text",
      )
      .refine(
        (body) => !/^\{\{\d\}\}/.test(body) && !/\{\{\d\}\}[.!?]?$/.test(body),
        "Meta does not allow the message to start or end with a {{variable}}",
      ),
    buttonText: z.string().trim().min(1).max(25, "Button text can be at most 25 characters"),
    /** Site address the button opens, e.g. https://www.birthdaywishs.in */
    baseUrl: z
      .string()
      .trim()
      .url("Enter the full site address")
      .refine((url) => url.startsWith("https://"), "The site address must start with https://"),
  })
  .strict();

export type SubmitTomorrowListTemplateInput = z.infer<
  typeof submitTomorrowListTemplateSchema
>;

export type TomorrowListTemplateStatus = {
  name: string;
  language: string;
  /** Meta's status: APPROVED, PENDING, REJECTED, PAUSED, DISABLED, or NOT_FOUND. */
  status: string;
  rejectedReason: string | null;
};

/** The Meta template payload: body with three variables, one dynamic URL button. */
export function buildTomorrowListTemplatePayload(
  input: SubmitTomorrowListTemplateInput,
) {
  const base = input.baseUrl.replace(/\/+$/, "");
  return {
    name: input.templateName,
    language: input.language,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: input.body,
        example: { body_text: [BODY_EXAMPLE] },
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: input.buttonText,
            url: `${base}/t/{{1}}`,
            example: [`${base}/t/${TOMORROW_LIST_SAMPLE_TOKEN}`],
          },
        ],
      },
    ],
  };
}

async function loadAccount() {
  const row = await prisma.platformDailySummaryConfig.findUnique({
    where: { id: CONFIG_ID },
  });
  if (!row) {
    throw new TomorrowListTemplateError(
      "Save the Meta account in the Daily Summary section first",
    );
  }
  return {
    accessToken: decryptCredentials(row.encryptedAccessToken),
    apiVersion: row.apiVersion,
    whatsappBusinessAccountId: row.whatsappBusinessAccountId,
    templateName: row.tomorrowListTemplateName,
    language: row.tomorrowListLanguage,
  };
}

async function metaFetch(
  url: string,
  accessToken: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), META_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TomorrowListTemplateError("Meta did not respond in time. Try again.");
    }
    throw new TomorrowListTemplateError("Could not reach Meta. Try again.");
  } finally {
    clearTimeout(timeout);
  }

  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = json.error as
      | { message?: string; error_user_msg?: string; error_user_title?: string }
      | undefined;
    throw new TomorrowListTemplateError(
      error?.error_user_msg ??
        error?.message ??
        `Meta returned an error (HTTP ${response.status})`,
    );
  }
  return json;
}

/**
 * Submits the Tomorrow's List template to Meta for approval and saves the
 * account ID, template name and language, so the list uses it once Meta
 * approves it. Does not switch Tomorrow's List on.
 */
export async function submitTomorrowListTemplate(
  input: SubmitTomorrowListTemplateInput,
): Promise<TomorrowListTemplateStatus> {
  const account = await loadAccount();

  const result = await metaFetch(
    `https://graph.facebook.com/${account.apiVersion}/${input.whatsappBusinessAccountId}/message_templates`,
    account.accessToken,
    { method: "POST", body: buildTomorrowListTemplatePayload(input) },
  );

  await prisma.platformDailySummaryConfig.update({
    where: { id: CONFIG_ID },
    data: {
      whatsappBusinessAccountId: input.whatsappBusinessAccountId,
      tomorrowListTemplateName: input.templateName,
      tomorrowListLanguage: input.language,
    },
  });

  return {
    name: input.templateName,
    language: input.language,
    status: typeof result.status === "string" ? result.status : "PENDING",
    rejectedReason: null,
  };
}

/** Meta's approval status for the saved Tomorrow's List template. */
export async function getTomorrowListTemplateStatus(): Promise<TomorrowListTemplateStatus> {
  const account = await loadAccount();
  if (!account.whatsappBusinessAccountId || !account.templateName) {
    throw new TomorrowListTemplateError(
      "Submit a template first, or enter the WhatsApp Business Account ID and template name",
    );
  }

  const params = new URLSearchParams({
    name: account.templateName,
    fields: "name,language,status,rejected_reason",
  });
  const result = await metaFetch(
    `https://graph.facebook.com/${account.apiVersion}/${account.whatsappBusinessAccountId}/message_templates?${params}`,
    account.accessToken,
    { method: "GET" },
  );

  const rows = (Array.isArray(result.data) ? result.data : []) as Array<{
    name?: string;
    language?: string;
    status?: string;
    rejected_reason?: string;
  }>;
  // Meta's name filter is a "contains" match, so pick the exact one.
  const match = rows.find(
    (row) => row.name === account.templateName && row.language === account.language,
  );

  return {
    name: account.templateName,
    language: account.language,
    status: match?.status ?? "NOT_FOUND",
    rejectedReason:
      match?.rejected_reason && match.rejected_reason !== "NONE"
        ? match.rejected_reason
        : null,
  };
}
