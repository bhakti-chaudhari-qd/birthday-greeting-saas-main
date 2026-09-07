import { describe, expect, it } from "vitest";

import {
  getOccasionMatchPairs,
  getOrganizationLocalIsoDate,
  parseTargetDate,
} from "@/lib/queue/dates";
import { buildOccasionIdempotencyKey } from "@/lib/queue/idempotency";
import {
  generateQueueSchema,
  listQueueQuerySchema,
} from "@/lib/validation/queue";

describe("queue validation helpers", () => {
  it("parses valid target dates", () => {
    const parsed = parseTargetDate("2026-07-11");
    expect(parsed.month).toBe(7);
    expect(parsed.day).toBe(11);
    expect(parsed.isoDate).toBe("2026-07-11");
  });

  it("rejects invalid target dates", () => {
    expect(() => parseTargetDate("2026-02-30")).toThrow();
  });

  it("builds deterministic idempotency keys", () => {
    const key = buildOccasionIdempotencyKey({
      contactId: "contact-1",
      channel: "SMS",
      occasionId: "occasion-1",
      targetDate: "2026-07-11",
    });

    expect(key).toBe(
      "occasion:contact-1:SMS:occasion-1:2026-07-11",
    );
  });

  it("includes Feb 29 occasions on Feb 28 in non-leap years", () => {
    const pairs = getOccasionMatchPairs(2, 28, 2025);
    expect(pairs).toEqual([
      { month: 2, day: 28 },
      { month: 2, day: 29 },
    ]);
  });

  it("formats organization local dates", () => {
    const isoDate = getOrganizationLocalIsoDate(
      "UTC",
      new Date("2026-07-11T12:00:00.000Z"),
    );
    expect(isoDate).toBe("2026-07-11");
  });

  it("requires templateId in generate schema", () => {
    const parsed = generateQueueSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it("rejects organizationId in generate schema", () => {
    const parsed = generateQueueSchema.safeParse({
      templateId: "template-1",
      organizationId: "other-org",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts optional targetDate in generate schema", () => {
    const parsed = generateQueueSchema.safeParse({
      templateId: "template-1",
      targetDate: "2026-07-11",
    });
    expect(parsed.success).toBe(true);
  });

  it("validates queue list query parameters", () => {
    const parsed = listQueueQuerySchema.safeParse({
      page: "1",
      limit: "10",
      status: "PENDING",
      channel: "SMS",
      scheduledDate: "2026-07-11",
    });
    expect(parsed.success).toBe(true);
  });
});
