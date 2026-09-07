import { describe, expect, it } from "vitest";

import {
  formatCustomerDateTime,
  formatCustomerDateTimeParts,
  formatDisplayDate,
  formatGreetingDayLabel,
  formatScheduledSendDetail,
  formatScheduledSendParts,
} from "@/lib/ui/datetime";

describe("display date formatting", () => {
  it("formats calendar days as DD-MM-YYYY", () => {
    expect(formatDisplayDate("2026-02-13")).toBe("13-02-2026");
    expect(formatGreetingDayLabel("2026-02-13")).toBe("13-02-2026");
    expect(formatGreetingDayLabel("2026-07-23")).toBe("23-07-2026");
  });

  it("formats schedule text with DD-MM-YYYY", () => {
    expect(formatScheduledSendDetail("2026-02-13", "2:00 PM IST")).toBe(
      "On 13-02-2026 at 2:00 PM IST",
    );
  });

  it("splits schedule into highlighted date and time parts", () => {
    expect(formatScheduledSendParts("2026-02-13", "2:00 PM IST")).toEqual({
      dayLabel: "13-02-2026",
      timeLabel: "2:00 PM IST",
    });
  });

  it("splits submitted timestamps into DD-MM-YYYY and 12-hour time", () => {
    const parts = formatCustomerDateTimeParts(
      new Date("2026-07-23T08:30:00.000Z"),
    );
    expect(parts.dateLabel).toBe("23-07-2026");
    expect(parts.timeLabel).toMatch(/\d{1,2}:\d{2}\s?(am|pm|AM|PM)/i);
  });

  it("formats customer datetime with DD-MM-YYYY and AM/PM", () => {
    const formatted = formatCustomerDateTime("2026-07-15T10:30:00.000Z");
    expect(formatted).toMatch(/^15-07-2026,/);
    expect(formatted).toMatch(/\b(AM|PM|am|pm)\b/i);
  });
});
