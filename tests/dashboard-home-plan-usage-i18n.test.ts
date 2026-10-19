import { describe, expect, it } from "vitest";

import { getDashboardHomeDict } from "@/lib/i18n/dictionaries/dashboard-home";
import { LOCALES } from "@/lib/i18n/constants";

const DEVANAGARI_PATTERN = /[ऀ-ॿ]/;

describe("dashboard home planUsage i18n", () => {
  it("has non-empty strings across all locales", () => {
    for (const locale of LOCALES) {
      const dict = getDashboardHomeDict(locale).planUsage;
      expect(dict.planExpiry.length).toBeGreaterThan(0);
      expect(dict.messagesRemaining.length).toBeGreaterThan(0);
      expect(dict.noExpiry.length).toBeGreaterThan(0);
      expect(dict.noMessageLimit.length).toBeGreaterThan(0);
      expect(dict.perChannelHeading.length).toBeGreaterThan(0);
    }
  });

  it("hi/mr contain Devanagari script", () => {
    const hi = getDashboardHomeDict("hi").planUsage;
    const mr = getDashboardHomeDict("mr").planUsage;
    expect(hi.planExpiry).toMatch(DEVANAGARI_PATTERN);
    expect(hi.messagesRemaining).toMatch(DEVANAGARI_PATTERN);
    expect(mr.planExpiry).toMatch(DEVANAGARI_PATTERN);
    expect(mr.messagesRemaining).toMatch(DEVANAGARI_PATTERN);
  });

  it("interpolated values appear correctly", () => {
    for (const locale of LOCALES) {
      const dict = getDashboardHomeDict(locale).planUsage;
      expect(dict.daysLeft(5)).toContain("5");
      expect(dict.daysLeft(1)).not.toContain("1 1");
      expect(dict.endsOn("19-10-2026")).toContain("19-10-2026");
      expect(dict.remainingOfTotal(250, 1000)).toContain("250");
      expect(dict.remainingOfTotal(250, 1000)).toContain("1000");
    }
  });

  it("English defaults match the intended strings", () => {
    const dict = getDashboardHomeDict("en").planUsage;
    expect(dict.planExpiry).toBe("Plan expiry");
    expect(dict.messagesRemaining).toBe("Messages remaining");
    expect(dict.daysLeft(1)).toBe("1 day left");
    expect(dict.daysLeft(3)).toBe("3 days left");
    expect(dict.channel.WHATSAPP).toBe("WhatsApp");
  });
});
