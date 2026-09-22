import { describe, expect, it } from "vitest";

import { startOfIstDay, startOfIstMonth } from "@/lib/admin/org-ops";

describe("admin usage snapshot: IST day/month boundaries", () => {
  it("places a UTC instant just after IST midnight in the new IST day, not the old UTC day", () => {
    // 2026-03-10T18:35:00Z is 2026-03-11 00:05 IST. The old UTC-day boundary
    // (startOfUtcDay) would have treated this as still 2026-03-10.
    const justAfterIstMidnight = new Date("2026-03-10T18:35:00.000Z");

    const dayStart = startOfIstDay(justAfterIstMidnight);
    // IST midnight of 2026-03-11 is 2026-03-10T18:30:00Z.
    expect(dayStart.toISOString()).toBe("2026-03-10T18:30:00.000Z");
    expect(dayStart.getTime()).toBeLessThanOrEqual(justAfterIstMidnight.getTime());

    // A delivery 10 minutes earlier (2026-03-10 23:55 IST, the previous IST
    // day) must fall before this boundary.
    const previousIstDay = new Date("2026-03-10T18:25:00.000Z");
    expect(previousIstDay.getTime()).toBeLessThan(dayStart.getTime());
  });

  it("places a UTC instant just after IST month start in the new IST month", () => {
    // 2026-03-01T00:15 IST = 2026-02-28T18:45:00Z - still February in UTC,
    // but already March in IST.
    const justAfterIstMonthStart = new Date("2026-02-28T18:45:00.000Z");

    const monthStart = startOfIstMonth(justAfterIstMonthStart);
    // IST midnight of 2026-03-01 is 2026-02-28T18:30:00Z.
    expect(monthStart.toISOString()).toBe("2026-02-28T18:30:00.000Z");
    expect(monthStart.getTime()).toBeLessThanOrEqual(
      justAfterIstMonthStart.getTime(),
    );

    const lastMinuteOfFebruaryIst = new Date("2026-02-28T18:20:00.000Z");
    expect(lastMinuteOfFebruaryIst.getTime()).toBeLessThan(monthStart.getTime());
  });

  it("is stable across a leap-year February -> March boundary", () => {
    // 2028 is a leap year; IST midnight of 2028-03-01 should be exact.
    const reference = new Date("2028-02-29T20:00:00.000Z"); // 2028-03-01 01:30 IST
    expect(startOfIstMonth(reference).toISOString()).toBe(
      "2028-02-29T18:30:00.000Z",
    );
  });
});
