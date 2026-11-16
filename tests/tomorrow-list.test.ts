import { describe, expect, it } from "vitest";

import { updatePlatformOrganizationSchema } from "@/lib/admin/org-ops";
import { updatePlatformTomorrowListSchema } from "@/lib/tomorrow-list/platform-config";
import {
  TOMORROW_LIST_SAMPLE_TOKEN,
  buildTomorrowListParameters,
  createTomorrowListToken,
  currentIstTime,
  getNextIsoDate,
  getTomorrowListView,
  hashTomorrowListToken,
  lastFourDigits,
  ownSendTimeReached,
  tomorrowListExpiresAt,
} from "@/lib/tomorrow-list/service";

describe("tomorrow list dates", () => {
  it("moves to the next calendar day across month, year and leap-day ends", () => {
    expect(getNextIsoDate("2026-11-16")).toBe("2026-11-17");
    expect(getNextIsoDate("2026-11-30")).toBe("2026-12-01");
    expect(getNextIsoDate("2026-12-31")).toBe("2027-01-01");
    expect(getNextIsoDate("2028-02-28")).toBe("2028-02-29");
    expect(getNextIsoDate("2027-02-28")).toBe("2027-03-01");
  });

  it("expires at midnight IST at the end of the list's day", () => {
    const expiresAt = tomorrowListExpiresAt("2026-11-17");
    // 18 Nov 00:00 IST = 17 Nov 18:30 UTC
    expect(expiresAt.toISOString()).toBe("2026-11-17T18:30:00.000Z");
  });
});

describe("tomorrow list tokens", () => {
  it("creates unguessable url-safe tokens and stores only a hash", () => {
    const a = createTomorrowListToken();
    const b = createTomorrowListToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(a).not.toBe(b);
    expect(hashTomorrowListToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashTomorrowListToken(a)).not.toContain(a);
  });

  it("treats malformed tokens as expired without touching the database", async () => {
    await expect(getTomorrowListView("bad token!")).resolves.toEqual({
      status: "expired",
    });
  });

  it("serves made-up names for the admin test link", async () => {
    const view = await getTomorrowListView(
      TOMORROW_LIST_SAMPLE_TOKEN,
      new Date("2026-11-16T15:00:00Z"),
    );
    expect(view.status).toBe("ok");
    if (view.status === "ok") {
      expect(view.isoDate).toBe("2026-11-17");
      expect(view.sections.map((section) => section.occasionName)).toEqual([
        "Birthday",
        "Anniversary",
      ]);
    }
  });
});

describe("tomorrow list masking", () => {
  it("keeps only the last four digits", () => {
    expect(lastFourDigits("9876543210")).toBe("3210");
    expect(lastFourDigits("+91 98765 43210")).toBe("3210");
  });
});

describe("buildTomorrowListParameters", () => {
  it("lists organization, date and count", () => {
    expect(buildTomorrowListParameters("Acme", "2026-11-17", 4)).toEqual([
      "Acme",
      "17 Nov 2026",
      "4",
    ]);
  });
});

describe("tomorrow list settings schemas", () => {
  it("accepts a valid platform config and rejects bad values", () => {
    const valid = {
      enabled: true,
      templateName: "tomorrow_list",
      language: "en",
      sendHour: 20,
    };
    expect(updatePlatformTomorrowListSchema.safeParse(valid).success).toBe(true);
    for (const bad of [
      { templateName: "Tomorrow List" },
      { language: "english" },
      { sendHour: 24 },
    ]) {
      expect(
        updatePlatformTomorrowListSchema.safeParse({ ...valid, ...bad }).success,
      ).toBe(false);
    }
  });

  it("lets a Platform Admin switch one client's list off by itself", () => {
    const parsed = updatePlatformOrganizationSchema.safeParse({
      tomorrowListAllowedByAdmin: false,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ tomorrowListAllowedByAdmin: false });
  });
});

describe("tomorrow list custom send time", () => {
  it("reads the IST wall-clock hour and minute", () => {
    // 05:52 UTC = 11:22 IST
    expect(currentIstTime(new Date("2026-11-16T05:52:00Z"))).toEqual({
      hour: 11,
      minute: 22,
    });
  });

  it("is due from the chosen minute on, and every later hour", () => {
    expect(ownSendTimeReached({ hour: 11, minute: 22 })).toEqual([
      { tomorrowListSendHour: { lt: 11 } },
      {
        tomorrowListSendHour: 11,
        OR: [
          { tomorrowListSendMinute: null },
          { tomorrowListSendMinute: { lte: 22 } },
        ],
      },
    ]);
  });
});
