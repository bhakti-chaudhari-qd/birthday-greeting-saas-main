import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  ChannelProvider,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@prisma/client";

import { PUT as putSmsChannelConfigRoute } from "@/app/api/v1/channel-config/sms/route";
import { assertWhatsAppTlsAllowed } from "@/lib/abuse/live-channels";
import { assertSubscriptionAllowsSending } from "@/lib/abuse/subscription-send";
import {
  SendVelocityError,
  assertAndRecordSendVelocity,
  getOrganizationSendVelocityBudget,
} from "@/lib/abuse/velocity";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createSessionRecord } from "@/lib/auth/session";
import { ChannelConfigValidationError } from "@/lib/channel-config/errors";
import { prisma } from "@/lib/db";
import { TEST_CREDENTIALS_ENCRYPTION_KEY } from "./sms-test-helpers";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

async function mockSessionCookie(rawToken: string) {
  const { cookies } = await import("next/headers");
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME ? { value: rawToken } : undefined,
    set: vi.fn(),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

describe("anti-abuse (REQ-ABUSE)", () => {
  beforeAll(async () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_CREDENTIALS_ENCRYPTION_KEY;
    process.env.ABUSE_ENFORCE_LIVE_GATES = "1";

    if (!databaseUrl) {
      return;
    }

    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  afterAll(async () => {
    delete process.env.ABUSE_ENFORCE_LIVE_GATES;
    await prisma.$disconnect();
  });

  it("blocks unpaid subscription status", () => {
    expect(() =>
      assertSubscriptionAllowsSending({ status: SubscriptionStatus.ACTIVE }),
    ).not.toThrow();
    expect(() =>
      assertSubscriptionAllowsSending({ status: SubscriptionStatus.PAST_DUE }),
    ).toThrow(/past due/i);
    expect(() =>
      assertSubscriptionAllowsSending({ status: SubscriptionStatus.CANCELLED }),
    ).toThrow(/cancelled/i);
  });

  it("blocks insecure WhatsApp TLS in production", () => {
    expect(() => {
      const previous = process.env.NODE_ENV;
      try {
        // @ts-expect-error test override
        process.env.NODE_ENV = "production";
        assertWhatsAppTlsAllowed(true);
      } finally {
        // @ts-expect-error restore
        process.env.NODE_ENV = previous;
      }
    }).toThrow(ChannelConfigValidationError);

    const previous = process.env.NODE_ENV;
    try {
      // @ts-expect-error test override
      process.env.NODE_ENV = "production";
      expect(() => assertWhatsAppTlsAllowed(false)).not.toThrow();
    } finally {
      // @ts-expect-error restore
      process.env.NODE_ENV = previous;
    }
  });

  it("brand-new free org cannot enable live Custom HTTP SMS", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization({
      organizationName: `Abuse Free ${suffix}`,
      organizationSlug: `abuse-free-${suffix}`,
      timezone: "UTC",
      adminName: "Owner",
      email: `abuse-free-${suffix}@test.local`,
      password: "password12345",
    });

    const session = await createSessionRecord(
      org.user.id,
      org.organization.id,
    );
    await mockSessionCookie(session.rawToken);

    try {
      const response = await putSmsChannelConfigRoute(
        new Request("http://localhost/api/v1/channel-config/sms", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            provider: ChannelProvider.CUSTOM_HTTP,
            username: "u",
            password: "p",
            baseUrl: "https://sms.example",
            sendPath: "/send.aspx",
            route: "trans1",
            senderId: "SENDER",
            isActive: true,
          }),
        }),
      );

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.message).toMatch(/paid plan|approval/i);
    } finally {
      await prisma.organization.delete({ where: { id: org.organization.id } });
    }
  });

  it("allows live Custom HTTP when STARTER", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization({
      organizationName: `Abuse Paid ${suffix}`,
      organizationSlug: `abuse-paid-${suffix}`,
      timezone: "UTC",
      adminName: "Owner",
      email: `abuse-paid-${suffix}@test.local`,
      password: "password12345",
    });

    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: {
        plan: SubscriptionPlan.STARTER,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    const session = await createSessionRecord(
      org.user.id,
      org.organization.id,
    );
    await mockSessionCookie(session.rawToken);

    try {
      const response = await putSmsChannelConfigRoute(
        new Request("http://localhost/api/v1/channel-config/sms", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            provider: ChannelProvider.CUSTOM_HTTP,
            username: "u",
            password: "p",
            baseUrl: "https://sms.example",
            sendPath: "/send.aspx",
            route: "trans1",
            senderId: "SENDER",
            isActive: true,
          }),
        }),
      );

      expect(response.status).toBe(200);
    } finally {
      await prisma.organization.delete({ where: { id: org.organization.id } });
    }
  });

  it("enforces per-org send velocity", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const previousMinute = process.env.SEND_VELOCITY_PER_MINUTE;
    process.env.SEND_VELOCITY_PER_MINUTE = "2";
    const orgId = `vel-${uniqueSuffix()}`;

    try {
      await assertAndRecordSendVelocity(orgId);
      await assertAndRecordSendVelocity(orgId);
      await expect(assertAndRecordSendVelocity(orgId)).rejects.toBeInstanceOf(
        SendVelocityError,
      );

      const budget = await getOrganizationSendVelocityBudget(orgId);
      expect(budget.perMinute).toBe(2);
      expect(budget.remaining).toBe(0);
      expect(budget.retryAfterMs).toBeGreaterThan(0);
    } finally {
      await prisma.authRateLimit.deleteMany({
        where: { bucketKey: { startsWith: `send:org:${orgId}:` } },
      });
      if (previousMinute === undefined) {
        delete process.env.SEND_VELOCITY_PER_MINUTE;
      } else {
        process.env.SEND_VELOCITY_PER_MINUTE = previousMinute;
      }
    }
  });

  it("scales day velocity with subscription up to the env ceiling", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const previousDay = process.env.SEND_VELOCITY_PER_DAY;
    const previousMinute = process.env.SEND_VELOCITY_PER_MINUTE;
    process.env.SEND_VELOCITY_PER_DAY = "8";
    process.env.SEND_VELOCITY_PER_MINUTE = "100";

    const org = await createRegisteredOrganization({
      organizationName: `Vel Org ${uniqueSuffix()}`,
      organizationSlug: `vel-org-${uniqueSuffix()}`,
      timezone: "UTC",
      adminName: "Vel Admin",
      email: `vel-admin-${uniqueSuffix()}@test.local`,
      password: "password12345",
    });

    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: { monthlyMessageLimit: 100_000 },
    });

    try {
      for (let i = 0; i < 8; i += 1) {
        await assertAndRecordSendVelocity(org.organization.id);
      }
      await expect(
        assertAndRecordSendVelocity(org.organization.id),
      ).rejects.toBeInstanceOf(SendVelocityError);
    } finally {
      await prisma.authRateLimit.deleteMany({
        where: {
          bucketKey: { startsWith: `send:org:${org.organization.id}:` },
        },
      });
      await prisma.organization.delete({ where: { id: org.organization.id } });
      if (previousDay === undefined) {
        delete process.env.SEND_VELOCITY_PER_DAY;
      } else {
        process.env.SEND_VELOCITY_PER_DAY = previousDay;
      }
      if (previousMinute === undefined) {
        delete process.env.SEND_VELOCITY_PER_MINUTE;
      } else {
        process.env.SEND_VELOCITY_PER_MINUTE = previousMinute;
      }
    }
  });
});
