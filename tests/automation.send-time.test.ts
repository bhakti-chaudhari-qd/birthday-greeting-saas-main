import { describe, expect, it } from "vitest";

import {
  buildAutomationScheduleDescription,
  formatAutomationSendTimeLabel,
  getAutomationSendInstant,
  hour12ToHour24,
  hour24ToHour12,
  isAtOrAfterAutomationSendTime,
  isAutomationOriginatedIdempotencyKey,
} from "@/lib/automation/send-time";
import { formatCustomerDateTime } from "@/lib/ui/datetime";

describe("automation send time", () => {
  it("formats clock times with AM/PM", () => {
    expect(formatAutomationSendTimeLabel(0, 0)).toBe("12:00 AM");
    expect(formatAutomationSendTimeLabel(6, 0)).toBe("6:00 AM");
    expect(formatAutomationSendTimeLabel(9, 30)).toBe("9:30 AM");
    expect(formatAutomationSendTimeLabel(12, 0)).toBe("12:00 PM");
    expect(formatAutomationSendTimeLabel(13, 5)).toBe("1:05 PM");
    expect(formatAutomationSendTimeLabel(23, 59)).toBe("11:59 PM");
    expect(formatAutomationSendTimeLabel(null, null)).toBe("Not set");
    expect(formatAutomationSendTimeLabel(undefined, undefined)).toBe("Not set");
  });

  it("formats the schedule description from hour and minute", () => {
    expect(buildAutomationScheduleDescription(9, 30)).toContain("9:30 AM IST");
    expect(buildAutomationScheduleDescription(9, 30)).toContain("at or after");
    expect(buildAutomationScheduleDescription(6, 0)).toContain("6:00 AM IST");
    expect(buildAutomationScheduleDescription(null, null)).toContain(
      "Set a send time",
    );
  });

  it("converts between 12-hour and 24-hour values", () => {
    expect(hour24ToHour12(0)).toEqual({ hour12: 12, period: "AM" });
    expect(hour24ToHour12(6)).toEqual({ hour12: 6, period: "AM" });
    expect(hour24ToHour12(12)).toEqual({ hour12: 12, period: "PM" });
    expect(hour24ToHour12(18)).toEqual({ hour12: 6, period: "PM" });
    expect(hour12ToHour24(12, "AM")).toBe(0);
    expect(hour12ToHour24(6, "AM")).toBe(6);
    expect(hour12ToHour24(12, "PM")).toBe(12);
    expect(hour12ToHour24(6, "PM")).toBe(18);
  });

  it("skips before the configured IST time and allows at/after", () => {
    // 05:00 IST on 2026-07-11
    const before = new Date("2026-07-10T23:30:00.000Z");
    // 06:00 IST on 2026-07-11
    const at = new Date("2026-07-11T00:30:00.000Z");
    // 06:01 IST
    const after = new Date("2026-07-11T00:31:00.000Z");

    expect(isAtOrAfterAutomationSendTime(6, 0, before)).toBe(false);
    expect(isAtOrAfterAutomationSendTime(6, 0, at)).toBe(true);
    expect(isAtOrAfterAutomationSendTime(6, 0, after)).toBe(true);
    expect(isAtOrAfterAutomationSendTime(9, 30, at)).toBe(false);
  });

  it("resolves the IST send instant in UTC", () => {
    const reference = new Date("2026-07-16T04:00:00.000Z"); // 09:30 IST
    expect(getAutomationSendInstant(10, 35, reference).toISOString()).toBe(
      "2026-07-16T05:05:00.000Z",
    );
  });

  it("detects automation-originated idempotency keys", () => {
    expect(
      isAutomationOriginatedIdempotencyKey(
        "occasion:contact:SMS:occasion-id:2026-07-16",
      ),
    ).toBe(true);
    expect(
      isAutomationOriginatedIdempotencyKey(
        "manual-send:op:contact:template:SMS:occasion-id",
      ),
    ).toBe(false);
  });
});

describe("customer datetime display", () => {
  it("formats with a 12-hour clock and DD-MM-YYYY date", () => {
    const formatted = formatCustomerDateTime("2026-07-15T10:30:00.000Z");
    expect(formatted).toMatch(/^15-07-2026,/);
    expect(formatted).toMatch(/\b(AM|PM|am|pm)\b/i);
  });
});
