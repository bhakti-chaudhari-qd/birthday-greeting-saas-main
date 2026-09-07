import type {
  RewriteMessageAction,
  RewriteMessageInput,
  SuggestMessageInput,
  SuggestMessageTone,
} from "@/lib/validation/ai";
import { validateTemplateVariables } from "@/lib/templates/variables";

import { logAiUsage } from "./usage-log";

export type SuggestMessageResult = {
  body: string;
  provider: "openai" | "curated";
  tone: SuggestMessageTone;
};

export type SuggestMessageVariantsResult = {
  variants: string[];
  provider: "openai" | "curated";
  tone: SuggestMessageTone;
};

export type RewriteMessageResult = {
  body: string;
  provider: "openai" | "curated";
  action: RewriteMessageAction;
};

export const SMS_SOFT_MAX = 320;
export const SMS_WARN_AT = 160;

export function getMessageLengthHint(
  body: string,
  channel: "SMS" | "WHATSAPP",
): string | null {
  const len = body.trim().length;
  if (channel === "SMS") {
    if (len > SMS_SOFT_MAX) {
      return `Message is ${len} characters (over ${SMS_SOFT_MAX}). Consider shortening for SMS.`;
    }
    if (len > SMS_WARN_AT) {
      return `Message is ${len} characters - may use more than one SMS segment.`;
    }
  }
  return null;
}

type CuratedBucket = "BIRTHDAY" | "ANNIVERSARY" | "CUSTOM";

/** Maps any occasion name to a curated fallback bucket. Unknown/custom
 * occasion names (Diwali, Retirement, ...) share the generic CUSTOM bank. */
function resolveCuratedBucket(occasionName?: string): CuratedBucket {
  const normalized = occasionName?.trim().toLowerCase();
  if (normalized === "birthday") return "BIRTHDAY";
  if (normalized === "anniversary") return "ANNIVERSARY";
  return "CUSTOM";
}

const CURATED: Record<CuratedBucket, Record<SuggestMessageTone, string[]>> = {
  BIRTHDAY: {
    warm: [
      "Happy Birthday {{name}}! Wishing you a wonderful year filled with joy and good health.",
      "Many happy returns, {{name}}! Hope your special day is as lovely as you are.",
      "Happy Birthday {{name}}! Sending warm wishes for a bright and happy year ahead.",
    ],
    short: [
      "Happy Birthday {{name}}! Have a wonderful day.",
      "Happy Birthday {{name}}! Best wishes.",
      "Cheers to you, {{name}}! Happy Birthday.",
    ],
    formal: [
      "Dear {{name}}, wishing you a very Happy Birthday and a prosperous year ahead.",
      "Season's greetings on your birthday, {{name}}. Warm regards and best wishes.",
      "Happy Birthday, {{name}}. We wish you continued success and good health.",
    ],
  },
  ANNIVERSARY: {
    warm: [
      "Happy Anniversary {{name}}! Wishing you both a beautiful day and many more years of happiness.",
      "Congratulations on your anniversary, {{name}}! May your journey together stay joyful.",
      "Happy Anniversary {{name}}! Sending warm wishes for a lovely celebration.",
    ],
    short: [
      "Happy Anniversary {{name}}! Best wishes.",
      "Congratulations {{name}}! Happy Anniversary.",
      "Happy Anniversary {{name}}! Have a wonderful day.",
    ],
    formal: [
      "Dear {{name}}, warm congratulations on your anniversary. Wishing you continued happiness.",
      "Happy Anniversary, {{name}}. Please accept our sincere best wishes for the years ahead.",
      "On your anniversary, {{name}}, we extend our formal greetings and best regards.",
    ],
  },
  CUSTOM: {
    warm: [
      "Best wishes, {{name}}! Hope your special day is filled with happiness.",
      "Thinking of you today, {{name}}. Warm greetings and a wonderful celebration!",
      "Hello {{name}}! Sending warm wishes for a joyful and memorable day.",
    ],
    short: [
      "Best wishes, {{name}}!",
      "Warm greetings, {{name}}!",
      "Have a wonderful day, {{name}}!",
    ],
    formal: [
      "Dear {{name}}, please accept our warmest greetings on this special occasion.",
      "Greetings {{name}}. We wish you a pleasant and successful celebration.",
      "Dear {{name}}, with sincere regards, we wish you a memorable day.",
    ],
  },
};

function pickCurated(
  occasionName: string | undefined,
  tone: SuggestMessageTone,
  avoidBodies: string[] = [],
): string {
  const options = CURATED[resolveCuratedBucket(occasionName)][tone];
  const avoided = new Set(avoidBodies.map((b) => b.trim()));
  const filtered = options.filter((item) => !avoided.has(item));
  const pool = filtered.length > 0 ? filtered : options;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function pickCuratedVariants(
  occasionName: string | undefined,
  tone: SuggestMessageTone,
  count: number,
): string[] {
  const options = [...CURATED[resolveCuratedBucket(occasionName)][tone]];
  // Shuffle
  for (let i = options.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j]!, options[i]!];
  }
  const picked = options.slice(0, Math.min(count, options.length));
  while (picked.length < count) {
    picked.push(pickCurated(occasionName, tone, picked));
  }
  return picked;
}

/** Normalize model output into a valid template body, or null if unusable. */
export function sanitizeSuggestedBody(
  raw: string,
  channel: SuggestMessageInput["channel"],
): string | null {
  let body = raw.trim();
  if (!body) {
    return null;
  }

  body = body.replace(/^```(?:\w+)?\s*/i, "").replace(/\s*```$/i, "").trim();
  body = body.replace(/^["']|["']$/g, "").trim();

  if (!/\{\{\s*name\s*\}\}/i.test(body)) {
    body = `${body.replace(/\s+$/, "")} {{name}}`.trim();
  }

  body = body.replace(/\{\{\s*name\s*\}\}/gi, "{{name}}");

  const max = channel === "SMS" ? SMS_SOFT_MAX : 1000;
  if (body.length > max) {
    body = `${body.slice(0, max - 1).trim()}…`;
    if (!body.includes("{{name}}")) {
      body = `${body.slice(0, Math.max(0, max - 10)).trim()} {{name}}`;
    }
  }

  try {
    validateTemplateVariables(body);
  } catch {
    return null;
  }

  return body;
}

function occasionLabel(occasionName?: string): string {
  const normalized = occasionName?.trim();
  if (!normalized) return "special occasion / custom greeting";
  if (normalized.toLowerCase() === "birthday") return "birthday";
  if (normalized.toLowerCase() === "anniversary") return "anniversary";
  return normalized;
}

function buildSuggestPrompt(input: SuggestMessageInput & { tone: SuggestMessageTone }): string {
  const toneHint =
    input.tone === "short"
      ? "Keep it under 100 characters if possible."
      : input.tone === "formal"
        ? "Use a polite, professional tone."
        : "Use a warm, friendly tone.";

  const channelHint =
    input.channel === "SMS"
      ? "This will be an SMS: keep it concise (under 300 characters)."
      : "This will be a WhatsApp greeting: 1-3 short sentences is ideal.";

  return [
    "You write greeting message templates for an Indian SMB messaging product.",
    "Return ONLY the message text. No quotes, no markdown, no explanation.",
    "You MUST include the exact placeholder {{name}} once (recipient first name).",
    "Do not invent other placeholders.",
    `Occasion: ${occasionLabel(input.occasionName)}.`,
    `Tone: ${input.tone}. ${toneHint}`,
    channelHint,
    input.existingBody?.trim()
      ? `Rewrite or improve this draft (keep {{name}}): ${input.existingBody.trim()}`
      : "Write a fresh greeting.",
  ].join("\n");
}

function buildVariantsPrompt(
  input: SuggestMessageInput & { tone: SuggestMessageTone },
  count: number,
): string {
  return [
    "You write greeting message templates for an Indian SMB messaging product.",
    `Return exactly ${count} different message options.`,
    "Format: one message per line, numbered 1. 2. 3. - no other text.",
    "Each MUST include the exact placeholder {{name}} once.",
    "Do not invent other placeholders.",
    `Occasion: ${occasionLabel(input.occasionName)}.`,
    `Tone: ${input.tone}.`,
    input.channel === "SMS"
      ? "Keep each under 300 characters (SMS)."
      : "Keep each to 1-3 short sentences (WhatsApp).",
  ].join("\n");
}

function buildRewritePrompt(input: RewriteMessageInput): string {
  const actionHint =
    input.action === "shorter"
      ? "Make it shorter and punchier while keeping the meaning."
      : input.action === "formal"
        ? "Make it more polite and professional."
        : "Make it warmer and more friendly.";

  return [
    "You rewrite greeting message templates.",
    "Return ONLY the rewritten message. No quotes, no markdown.",
    "Keep the exact placeholder {{name}} (add it if missing).",
    "Do not invent other placeholders.",
    actionHint,
    input.channel === "SMS" ? "Keep under 300 characters." : "",
    `Draft to rewrite: ${input.body}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function callOpenAI(userPrompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.9,
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content:
              "You generate short greeting SMS/WhatsApp templates. Follow the user instructions exactly.",
          },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error(
        "OpenAI AI request failed",
        response.status,
        await response.text().catch(() => ""),
      );
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : null;
  } catch (error) {
    console.error("OpenAI AI request error", error);
    return null;
  }
}

function parseNumberedVariants(raw: string, channel: SuggestMessageInput["channel"], count: number): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);

  const variants: string[] = [];
  for (const line of lines) {
    const cleaned = sanitizeSuggestedBody(line, channel);
    if (cleaned && !variants.includes(cleaned)) {
      variants.push(cleaned);
    }
    if (variants.length >= count) {
      break;
    }
  }
  return variants;
}

/**
 * Suggest a greeting template body.
 * Prefers OpenAI when OPENAI_API_KEY is set; always falls back to curated drafts.
 */
export async function suggestMessage(
  input: SuggestMessageInput,
  options: { organizationId?: string } = {},
): Promise<SuggestMessageResult> {
  const tone = input.tone ?? "warm";
  const normalized = { ...input, tone };

  const fromOpenAi = await callOpenAI(buildSuggestPrompt(normalized));
  const sanitized = fromOpenAi
    ? sanitizeSuggestedBody(fromOpenAi, normalized.channel)
    : null;

  if (sanitized) {
    logAiUsage({
      action: "suggest",
      organizationId: options.organizationId,
      provider: "openai",
      occasionName: normalized.occasionName,
      channel: normalized.channel,
      tone,
    });
    return { body: sanitized, provider: "openai", tone };
  }

  const curated = pickCurated(
    normalized.occasionName,
    tone,
    normalized.existingBody ? [normalized.existingBody] : [],
  );
  const body =
    sanitizeSuggestedBody(curated, normalized.channel) ?? curated;

  logAiUsage({
    action: "suggest",
    organizationId: options.organizationId,
    provider: "curated",
    occasionName: normalized.occasionName,
    channel: normalized.channel,
    tone,
  });

  return { body, provider: "curated", tone };
}

/** Return multiple draft variants for the user to pick. */
export async function suggestMessageVariants(
  input: SuggestMessageInput,
  options: { organizationId?: string } = {},
): Promise<SuggestMessageVariantsResult> {
  const tone = input.tone ?? "warm";
  const count = input.variantCount ?? 3;
  const normalized = { ...input, tone, variantCount: count };

  const fromOpenAi = await callOpenAI(buildVariantsPrompt(normalized, count));
  let variants = fromOpenAi
    ? parseNumberedVariants(fromOpenAi, normalized.channel, count)
    : [];

  let provider: "openai" | "curated" = "openai";
  if (variants.length < count) {
    provider = variants.length > 0 ? "openai" : "curated";
    const curated = pickCuratedVariants(
      normalized.occasionName,
      tone,
      count,
    ).map(
      (item) =>
        sanitizeSuggestedBody(item, normalized.channel) ?? item,
    );
    for (const item of curated) {
      if (!variants.includes(item)) {
        variants.push(item);
      }
      if (variants.length >= count) {
        break;
      }
    }
  }

  variants = variants.slice(0, count);

  logAiUsage({
    action: "variants",
    organizationId: options.organizationId,
    provider,
    occasionName: normalized.occasionName,
    channel: normalized.channel,
    tone,
    variantCount: variants.length,
  });

  return { variants, provider, tone };
}

/** Rewrite an existing draft (shorter / formal / warmer). */
export async function rewriteMessage(
  input: RewriteMessageInput,
  options: { organizationId?: string } = {},
): Promise<RewriteMessageResult> {
  const fromOpenAi = await callOpenAI(buildRewritePrompt(input));
  const sanitized = fromOpenAi
    ? sanitizeSuggestedBody(fromOpenAi, input.channel)
    : null;

  if (sanitized) {
    logAiUsage({
      action: "rewrite",
      organizationId: options.organizationId,
      provider: "openai",
      channel: input.channel,
      rewriteAction: input.action,
      occasionName: input.occasionName,
    });
    return { body: sanitized, provider: "openai", action: input.action };
  }

  // Curated rewrite fallbacks map action → tone pick
  const tone: SuggestMessageTone =
    input.action === "shorter"
      ? "short"
      : input.action === "formal"
        ? "formal"
        : "warm";
  const occasion = input.occasionName;
  const curated = pickCurated(occasion, tone, [input.body]);
  const body = sanitizeSuggestedBody(curated, input.channel) ?? curated;

  logAiUsage({
    action: "rewrite",
    organizationId: options.organizationId,
    provider: "curated",
    channel: input.channel,
    rewriteAction: input.action,
    occasionName: occasion,
  });

  return { body, provider: "curated", action: input.action };
}
