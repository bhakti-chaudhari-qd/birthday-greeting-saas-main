import { Channel, ChannelProvider } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import {
  GET as getEmailChannelConfigRoute,
  PUT as putEmailChannelConfigRoute,
} from "@/app/api/v1/channel-config/email/route";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createSessionRecord } from "@/lib/auth/session";
import { resolveEmailProviderConfig } from "@/lib/channel-config/email-resolve";
import {
  getEmailChannelConfig,
  upsertEmailChannelConfig,
} from "@/lib/channel-config/email-service";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { resolveMessageProvider } from "@/lib/messaging/providers/factory";
import type { EmailMessageSendRequest } from "@/lib/messaging/providers/types";
import { TEST_CREDENTIALS_ENCRYPTION_KEY } from "./sms-test-helpers";
import { uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registerInput(suffix: string) {
  return {
    organizationName: `Email Channel Org ${suffix}`,
    organizationSlug: `email-channel-org-${suffix}`,
    timezone: "UTC",
    adminName: "Email Channel Admin",
    email: `email-channel-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

async function mockSessionCookie(rawToken: string) {
  const { cookies } = await import("next/headers");

  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME ? { value: rawToken } : undefined,
    set: vi.fn(),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

function emailSendRequest(): EmailMessageSendRequest {
  return {
    channel: "EMAIL",
    recipient: "recipient@example.com",
    subject: "Happy Birthday!",
    body: "Wishing you a wonderful day.",
    idempotencyKey: `test-${uniqueSuffix()}`,
    attemptNumber: 1,
  };
}

describe("Email channel configuration", () => {
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

  describe("API routes", () => {
    it("rejects unauthenticated GET requests", async () => {
      const { cookies } = await import("next/headers");
      vi.mocked(cookies).mockResolvedValue({
        get: () => undefined,
        set: vi.fn(),
      } as unknown as Awaited<ReturnType<typeof cookies>>);

      const response = await getEmailChannelConfigRoute();
      expect(response.status).toBe(401);
    });

    it("creates and loads a Resend configuration without ever exposing the API key", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
      const session = await createSessionRecord(org.user.id, org.organization.id);
      await mockSessionCookie(session.rawToken);

      try {
        const createResponse = await putEmailChannelConfigRoute(
          new Request("http://localhost/api/v1/channel-config/email", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: "RESEND",
              apiKey: "re_secret_test_key",
              fromEmail: "greetings@example.com",
              fromName: "Example Greetings",
              isActive: true,
            }),
          }),
        );
        const createBody = await createResponse.json();

        expect(createResponse.status).toBe(200);
        expect(createBody.data.provider).toBe("RESEND");
        expect(createBody.data.fromEmail).toBe("greetings@example.com");
        expect(createBody.data.fromName).toBe("Example Greetings");
        expect(createBody.data.credentialsConfigured).toBe(true);
        expect(JSON.stringify(createBody)).not.toContain("re_secret_test_key");
        expect(JSON.stringify(createBody)).not.toContain("enc:v1:");

        const getResponse = await getEmailChannelConfigRoute();
        const getBody = await getResponse.json();

        expect(getResponse.status).toBe(200);
        expect(getBody.data.configured).toBe(true);
        expect(getBody.data.fromEmail).toBe("greetings@example.com");
        expect(JSON.stringify(getBody)).not.toContain("re_secret_test_key");
      } finally {
        await cleanupOrganization(org.organization.id);
      }
    });

    it("preserves the existing API key when an update omits it", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
      const session = await createSessionRecord(org.user.id, org.organization.id);
      await mockSessionCookie(session.rawToken);

      try {
        await upsertEmailChannelConfig(org.organization.id, {
          provider: ChannelProvider.RESEND,
          apiKey: "re_original_key",
          fromEmail: "original@example.com",
          isActive: true,
        });

        // Only changes fromName - does not resend the API key.
        const updateResponse = await putEmailChannelConfigRoute(
          new Request("http://localhost/api/v1/channel-config/email", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: "RESEND",
              fromEmail: "original@example.com",
              fromName: "Updated Name",
              isActive: true,
            }),
          }),
        );
        const updateBody = await updateResponse.json();

        expect(updateResponse.status).toBe(200);
        expect(updateBody.data.fromName).toBe("Updated Name");
        expect(updateBody.data.credentialsConfigured).toBe(true);

        const raw = await prisma.channelConfig.findUniqueOrThrow({
          where: {
            organizationId_channel: {
              organizationId: org.organization.id,
              channel: Channel.EMAIL,
            },
          },
        });
        const resolved = resolveEmailProviderConfig(raw);
        expect(resolved.apiKey).toBe("re_original_key");
      } finally {
        await cleanupOrganization(org.organization.id);
      }
    });

    it("rejects a Resend configuration missing From email", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
      const session = await createSessionRecord(org.user.id, org.organization.id);
      await mockSessionCookie(session.rawToken);

      try {
        const response = await putEmailChannelConfigRoute(
          new Request("http://localhost/api/v1/channel-config/email", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: "RESEND",
              apiKey: "re_key",
              isActive: true,
            }),
          }),
        );

        expect(response.status).toBe(400);
      } finally {
        await cleanupOrganization(org.organization.id);
      }
    });

    it("rejects an invalid From email format", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
      const session = await createSessionRecord(org.user.id, org.organization.id);
      await mockSessionCookie(session.rawToken);

      try {
        const response = await putEmailChannelConfigRoute(
          new Request("http://localhost/api/v1/channel-config/email", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: "RESEND",
              apiKey: "re_key",
              fromEmail: "not-an-email",
              isActive: true,
            }),
          }),
        );

        expect(response.status).toBe(400);
      } finally {
        await cleanupOrganization(org.organization.id);
      }
    });

    it("scopes configuration reads to the authenticated tenant", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const orgA = await createRegisteredOrganization(registerInput(uniqueSuffix()));
      const orgB = await createRegisteredOrganization(registerInput(uniqueSuffix()));
      const sessionB = await createSessionRecord(orgB.user.id, orgB.organization.id);
      await mockSessionCookie(sessionB.rawToken);

      try {
        await upsertEmailChannelConfig(orgA.organization.id, {
          provider: ChannelProvider.RESEND,
          apiKey: "re_org_a_key",
          fromEmail: "org-a@example.com",
          isActive: true,
        });

        const response = await getEmailChannelConfigRoute();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.configured).toBe(false);
      } finally {
        await cleanupOrganization(orgA.organization.id);
        await cleanupOrganization(orgB.organization.id);
      }
    });

    it("enable/disable: an inactive configuration reports isActive: false", async ({ skip }) => {
      if (!databaseAvailable) skip();

      const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

      try {
        const config = await upsertEmailChannelConfig(org.organization.id, {
          provider: ChannelProvider.RESEND,
          apiKey: "re_key",
          fromEmail: "greetings@example.com",
          isActive: false,
        });

        expect(config.isActive).toBe(false);

        const reloaded = await getEmailChannelConfig(org.organization.id);
        expect(reloaded.isActive).toBe(false);
      } finally {
        await cleanupOrganization(org.organization.id);
      }
    });
  });

  describe("sending resolves the correct organization's configuration", () => {
    it("organization A and organization B send with their own distinct API key and From address", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const orgA = await createRegisteredOrganization(registerInput(uniqueSuffix()));
      const orgB = await createRegisteredOrganization(registerInput(uniqueSuffix()));

      try {
        await upsertEmailChannelConfig(orgA.organization.id, {
          provider: ChannelProvider.RESEND,
          apiKey: "re_org_a_key",
          fromEmail: "org-a@example.com",
          fromName: "Org A",
          isActive: true,
        });
        await upsertEmailChannelConfig(orgB.organization.id, {
          provider: ChannelProvider.RESEND,
          apiKey: "re_org_b_key",
          fromEmail: "org-b@example.com",
          fromName: "Org B",
          isActive: true,
        });

        const configA = await prisma.channelConfig.findUniqueOrThrow({
          where: {
            organizationId_channel: { organizationId: orgA.organization.id, channel: Channel.EMAIL },
          },
        });
        const configB = await prisma.channelConfig.findUniqueOrThrow({
          where: {
            organizationId_channel: { organizationId: orgB.organization.id, channel: Channel.EMAIL },
          },
        });

        vi.mocked(sendEmail).mockClear();

        const providerA = resolveMessageProvider(configA, Channel.EMAIL);
        await providerA.send(emailSendRequest());

        const providerB = resolveMessageProvider(configB, Channel.EMAIL);
        await providerB.send(emailSendRequest());

        expect(sendEmail).toHaveBeenCalledTimes(2);
        expect(sendEmail).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            apiKey: "re_org_a_key",
            from: "Org A <org-a@example.com>",
          }),
        );
        expect(sendEmail).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            apiKey: "re_org_b_key",
            from: "Org B <org-b@example.com>",
          }),
        );
      } finally {
        await cleanupOrganization(orgA.organization.id);
        await cleanupOrganization(orgB.organization.id);
      }
    });

    it("falls back to the platform default when an organization has no Email configuration (backward compatibility)", async () => {
      vi.mocked(sendEmail).mockClear();

      const provider = resolveMessageProvider(null, Channel.EMAIL);
      await provider.send(emailSendRequest());

      expect(sendEmail).toHaveBeenCalledTimes(1);
      const call = vi.mocked(sendEmail).mock.calls[0]![0];
      expect(call.apiKey).toBeUndefined();
      expect(call.from).toBeUndefined();
    });
  });

  describe("credential safety", () => {
    it("never includes the raw apiKey or the enc:v1: ciphertext prefix in any serialized view", async ({
      skip,
    }) => {
      if (!databaseAvailable) skip();

      const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

      try {
        const config = await upsertEmailChannelConfig(org.organization.id, {
          provider: ChannelProvider.RESEND,
          apiKey: "re_super_secret",
          fromEmail: "greetings@example.com",
          isActive: true,
        });

        expect(JSON.stringify(config)).not.toContain("re_super_secret");
        expect(JSON.stringify(config)).not.toContain("enc:v1:");

        const reloaded = await getEmailChannelConfig(org.organization.id);
        expect(JSON.stringify(reloaded)).not.toContain("re_super_secret");
        expect(JSON.stringify(reloaded)).not.toContain("enc:v1:");
      } finally {
        await cleanupOrganization(org.organization.id);
      }
    });
  });
});
