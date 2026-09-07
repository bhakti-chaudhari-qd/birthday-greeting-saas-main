import type { Channel } from "@prisma/client";

/**
 * occasionId is already globally unique (cuid), so no per-occasion prefix
 * constant is needed - unlike the old enum-keyed keys, this key shape is
 * stable for any occasion, including ones created after this code shipped.
 */
export function buildOccasionIdempotencyKey(input: {
  contactId: string;
  channel: Channel;
  occasionId: string;
  targetDate: string;
}): string {
  return [
    "occasion",
    input.contactId,
    input.channel,
    input.occasionId,
    input.targetDate,
  ].join(":");
}

export function buildManualSendIdempotencyKey(input: {
  operationId: string;
  contactId: string;
  templateId: string;
  channel: Channel;
  occasionId: string;
}): string {
  return [
    "manual-send",
    input.operationId,
    input.contactId,
    input.templateId,
    input.channel,
    input.occasionId,
  ].join(":");
}
