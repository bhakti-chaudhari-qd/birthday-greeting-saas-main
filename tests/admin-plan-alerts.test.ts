import { Channel, SubscriptionPlan } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOrganizations: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    organization: { findMany: mocks.findOrganizations },
  },
}));

import { getPlatformPlanAlerts } from "@/lib/admin/plan-alerts";

const NOW = new Date("2026-10-19T06:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function org(
  id: string,
  subscription: Partial<{
    plan: SubscriptionPlan;
    paidUntil: Date | null;
    monthlyMessageLimit: number;
    bonusMessageCredits: number;
    messagesSentThisMonth: number;
    billingPeriodStart: Date;
    channelLimits: Array<{
      channel: Channel;
      monthlyLimit: number;
      messagesSentThisMonth: number;
    }>;
  }>,
) {
  return {
    id,
    name: `Client ${id}`,
    subscription: {
      plan: SubscriptionPlan.STARTER,
      paidUntil: null,
      monthlyMessageLimit: 1000,
      bonusMessageCredits: 0,
      messagesSentThisMonth: 0,
      billingPeriodStart: new Date("2026-10-01T00:00:00.000Z"),
      channelLimits: [],
      ...subscription,
    },
  };
}

describe("getPlatformPlanAlerts", () => {
  beforeEach(() => {
    mocks.findOrganizations.mockReset();
  });

  it("lists paid plans ending within 8 days, soonest first, and nothing else", async () => {
    mocks.findOrganizations.mockResolvedValue([
      org("later", { paidUntil: new Date(NOW.getTime() + 7.5 * DAY_MS) }),
      org("soon", { paidUntil: new Date(NOW.getTime() + 2 * 60 * 60 * 1000) }),
      org("edge", { paidUntil: new Date(NOW.getTime() + 8 * DAY_MS) }),
      org("too-far", { paidUntil: new Date(NOW.getTime() + 9 * DAY_MS) }),
      org("expired", { paidUntil: new Date(NOW.getTime() - DAY_MS) }),
      org("free", {
        plan: SubscriptionPlan.FREE,
        paidUntil: new Date(NOW.getTime() + DAY_MS),
      }),
    ]);

    const { warningDays, expiringPlans } = await getPlatformPlanAlerts(NOW);

    expect(warningDays).toBe(8);
    expect(expiringPlans.map((alert) => [alert.organizationId, alert.daysLeft])).toEqual([
      ["soon", 1],
      ["later", 8],
      ["edge", 8],
    ]);
  });

  it("flags each used-up channel on a CUSTOM plan, ignoring unallocated channels", async () => {
    mocks.findOrganizations.mockResolvedValue([
      org("custom", {
        plan: SubscriptionPlan.CUSTOM,
        messagesSentThisMonth: 700,
        channelLimits: [
          { channel: Channel.WHATSAPP, monthlyLimit: 500, messagesSentThisMonth: 500 },
          { channel: Channel.SMS, monthlyLimit: 300, messagesSentThisMonth: 200 },
          { channel: Channel.EMAIL, monthlyLimit: 0, messagesSentThisMonth: 0 },
        ],
      }),
    ]);

    const { exhaustedChannels } = await getPlatformPlanAlerts(NOW);

    expect(exhaustedChannels).toEqual([
      expect.objectContaining({
        organizationId: "custom",
        limits: [{ channel: Channel.WHATSAPP, used: 500, limit: 500 }],
      }),
    ]);
  });

  it("uses the shared monthly limit (with bonus credits) on other plans", async () => {
    mocks.findOrganizations.mockResolvedValue([
      org("full", { monthlyMessageLimit: 1000, messagesSentThisMonth: 1000 }),
      org("bonus", {
        monthlyMessageLimit: 1000,
        bonusMessageCredits: 200,
        messagesSentThisMonth: 1000,
      }),
    ]);

    const { exhaustedChannels } = await getPlatformPlanAlerts(NOW);

    expect(exhaustedChannels).toEqual([
      expect.objectContaining({
        organizationId: "full",
        limits: [{ channel: "ALL", used: 1000, limit: 1000 }],
      }),
    ]);
  });

  it("ignores usage left over from a previous IST month", async () => {
    mocks.findOrganizations.mockResolvedValue([
      org("stale", {
        messagesSentThisMonth: 1000,
        billingPeriodStart: new Date("2026-09-01T00:00:00.000Z"),
      }),
    ]);

    const { exhaustedChannels } = await getPlatformPlanAlerts(NOW);

    expect(exhaustedChannels).toEqual([]);
  });
});
