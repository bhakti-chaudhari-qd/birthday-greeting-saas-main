import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { Channel, ChannelProvider, type ChannelConfig } from "@prisma/client";

import { PUT as putSmsChannelConfigRoute } from "@/app/api/v1/channel-config/sms/route";
import { PUT as putWhatsAppChannelConfigRoute } from "@/app/api/v1/channel-config/whatsapp/route";
import { PUT as putEmailChannelConfigRoute } from "@/app/api/v1/channel-config/email/route";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createSessionRecord } from "@/lib/auth/session";
import { resolveSmsProviderMode } from "@/lib/queue/provider-send-eligibility";
import { smsChannelConfigWriteSchema } from "@/lib/validation/channel-config";
import { whatsappChannelConfigWriteSchema } from "@/lib/validation/whatsapp-channel-config";
import { emailChannelConfigWriteSchema } from "@/lib/validation/email-channel-config";
import { prisma } from "@/lib/db";
import { TEST_CREDENTIALS_ENCRYPTION_KEY } from "./sms-test-helpers";
import { uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registerInput(suffix: string) {
  return {
    organizationName: `Provider Cleanup Org ${suffix}`,
    organizationSlug: `provider-cleanup-org-${suffix}`,
    timezone: "UTC",
    adminName: "Provider Cleanup Admin",
    email: `provider-cleanup-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

async function mockSessionCookie(rawToken: string) {
  const { cookies } = await import("next/headers");
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) => (name === SESSION_COOKIE_NAME ? { value: rawToken } : undefined),
    set: vi.fn(),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

describe("production channel configuration is live-only (no Test/Simulation provider)", () => {
  beforeAll(async () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_CREDENTIALS_ENCRYPTION_KEY;

    if (!databaseUrl) return;
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("write-schema rejects TEST as a provider value", () => {
    it("SMS write schema rejects provider: TEST", () => {
      const result = smsChannelConfigWriteSchema.safeParse({
        provider: "TEST",
        isActive: true,
      });
      expect(result.success).toBe(false);
    });

    it("WhatsApp write schema rejects provider: TEST", () => {
      const result = whatsappChannelConfigWriteSchema.safeParse({
        provider: "TEST",
        isActive: true,
      });
      expect(result.success).toBe(false);
    });

    it("Email write schema rejects provider: TEST", () => {
      const result = emailChannelConfigWriteSchema.safeParse({
        provider: "TEST",
        isActive: true,
      });
      expect(result.success).toBe(false);
    });

    it("the real, live provider is still a valid selection for each channel", () => {
      expect(
        smsChannelConfigWriteSchema.safeParse({
          provider: "CUSTOM_HTTP",
          username: "user",
          password: "pass",
          baseUrl: "https://sms.example",
          sendPath: "/send",
          route: "trans1",
          senderId: "SENDER",
        }).success,
      ).toBe(true);
      expect(
        whatsappChannelConfigWriteSchema.safeParse({
          provider: "CUSTOM_HTTP",
          username: "user",
          password: "pass",
          baseUrl: "https://wa.example",
          sendPath: "/send",
        }).success,
      ).toBe(true);
      expect(
        emailChannelConfigWriteSchema.safeParse({
          provider: "RESEND",
          apiKey: "re_key",
          fromEmail: "greetings@example.com",
        }).success,
      ).toBe(true);
    });
  });

  describe("no silent simulated send when a channel is unconfigured", () => {
    it("resolveSmsProviderMode fails closed instead of returning TEST when there is no channel config", () => {
      expect(() => resolveSmsProviderMode(null)).toThrow(
        "SMS channel must be configured before sending",
      );
    });

    function fixtureChannelConfig(overrides: Partial<ChannelConfig>): ChannelConfig {
      return {
        id: "cfg-1",
        organizationId: "org-1",
        channel: Channel.SMS,
        provider: ChannelProvider.CUSTOM_HTTP,
        encryptedCredentials: "enc:v1:whatever",
        settings: null,
        vendorId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
      };
    }

    it("resolveSmsProviderMode fails closed for an inactive channel config", () => {
      expect(() =>
        resolveSmsProviderMode(fixtureChannelConfig({ isActive: false })),
      ).toThrow("SMS channel must be configured before sending");
    });

    it("resolveSmsProviderMode still resolves TEST for a directly-created TEST fixture row (automated testing mocks remain allowed)", () => {
      const mode = resolveSmsProviderMode(
        fixtureChannelConfig({ provider: ChannelProvider.TEST }),
      );
      expect(mode).toBe("TEST");
    });
  });

  describe("the production API rejects a PUT with provider: TEST", () => {
    it("PUT /api/v1/channel-config/sms rejects provider: TEST with 400", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
      const session = await createSessionRecord(org.user.id, org.organization.id);
      await mockSessionCookie(session.rawToken);

      try {
        const response = await putSmsChannelConfigRoute(
          new Request("http://localhost/api/v1/channel-config/sms", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: "TEST", isActive: true }),
          }),
        );
        expect(response.status).toBe(400);

        const config = await prisma.channelConfig.findUnique({
          where: { organizationId_channel: { organizationId: org.organization.id, channel: "SMS" } },
        });
        expect(config).toBeNull();
      } finally {
        await cleanupOrganization(org.organization.id);
      }
    });

    it("PUT /api/v1/channel-config/whatsapp rejects provider: TEST with 400", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
      const session = await createSessionRecord(org.user.id, org.organization.id);
      await mockSessionCookie(session.rawToken);

      try {
        const response = await putWhatsAppChannelConfigRoute(
          new Request("http://localhost/api/v1/channel-config/whatsapp", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: "TEST", isActive: true }),
          }),
        );
        expect(response.status).toBe(400);

        const config = await prisma.channelConfig.findUnique({
          where: {
            organizationId_channel: { organizationId: org.organization.id, channel: "WHATSAPP" },
          },
        });
        expect(config).toBeNull();
      } finally {
        await cleanupOrganization(org.organization.id);
      }
    });

    it("PUT /api/v1/channel-config/email rejects provider: TEST with 400", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
      const session = await createSessionRecord(org.user.id, org.organization.id);
      await mockSessionCookie(session.rawToken);

      try {
        const response = await putEmailChannelConfigRoute(
          new Request("http://localhost/api/v1/channel-config/email", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: "TEST", isActive: true }),
          }),
        );
        expect(response.status).toBe(400);

        const config = await prisma.channelConfig.findUnique({
          where: { organizationId_channel: { organizationId: org.organization.id, channel: "EMAIL" } },
        });
        expect(config).toBeNull();
      } finally {
        await cleanupOrganization(org.organization.id);
      }
    });
  });
});
