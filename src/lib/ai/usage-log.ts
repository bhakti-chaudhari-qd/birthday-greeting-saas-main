/**
 * Lightweight AI usage logging for cost/debug (Phase 2).
 * Structured console lines - no DB table yet.
 */
export function logAiUsage(event: {
  action:
    | "suggest"
    | "rewrite"
    | "variants"
    | "apply_whatsapp_media"
    | "help_chat";
  organizationId?: string;
  provider: "openai" | "curated" | "studio";
  occasionName?: string;
  channel?: string;
  tone?: string;
  rewriteAction?: string;
  variantCount?: number;
  mediaContentType?: string;
}) {
  console.info(
    JSON.stringify({
      type: "ai_usage",
      at: new Date().toISOString(),
      ...event,
    }),
  );
}
