import { describe, expect, it } from "vitest";

import {
  getEffectiveMonthlyMessageLimit,
  getRemainingMonthlySendCapacity,
} from "@/lib/queue/limits";

describe("monthly send capacity with bonus credits", () => {
  it("adds bonus credits to the plan base limit", () => {
    expect(
      getEffectiveMonthlyMessageLimit({
        monthlyMessageLimit: 10_000,
        bonusMessageCredits: 5_000,
      }),
    ).toBe(15_000);
  });

  it("treats missing bonus as zero", () => {
    expect(
      getEffectiveMonthlyMessageLimit({
        monthlyMessageLimit: 500,
      }),
    ).toBe(500);
  });

  it("counts remaining against base plus bonus", () => {
    expect(
      getRemainingMonthlySendCapacity({
        monthlyMessageLimit: 100,
        bonusMessageCredits: 50,
        messagesSentThisMonth: 120,
      }),
    ).toBe(30);
  });

  it("returns zero when usage meets or exceeds effective limit", () => {
    expect(
      getRemainingMonthlySendCapacity({
        monthlyMessageLimit: 100,
        bonusMessageCredits: 0,
        messagesSentThisMonth: 100,
      }),
    ).toBe(0);
  });
});
