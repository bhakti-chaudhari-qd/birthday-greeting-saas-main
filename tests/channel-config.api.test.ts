import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ChannelProvider } from "@prisma/client";

import { GET as getSmsChannelBalanceRoute } from "@/app/api/v1/channel-config/sms/balance/route";
import  { GET as getSmsChannelConfigRoute, PUT as putSmsChannelConfigRoute } from "@/app/api/v1/channel-config/sms/route";
import  { POST as verifySmsChannelConfigRoute } from "@/app/api/v1/channel-config/sms/verify/route";
import  { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createSessionRecord } from "@/lib/auth/session";
import { upsertSmsChannelConfig } from "@/lib/channel-config/service";
import { prisma } from "@/lib/db";
import { TEST_CREDENTIALS_ENCRYPTION_KEY } from "./sms-test-helpers";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registerInput(suffix: string) {
  return {
    organizationName: `Channel API Org ${suffix}`,
    organizationSlug: `channel-api-org-${suffix}`,
    timezone: "UTC",
    adminName: "API Admin",
    email: `channel-api-${suffix}@test.local`,
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

describe("SMS channel config API routes", () => {
  beforeAll(async () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_CREDENTIALS_ENCRYPTION_KEY;

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
    await prisma.$disconnect();
  });

  it("rejects unauthenticated GET requests", async () => {
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
      set: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const response = await getSmsChannelConfigRoute();
    expect(response.status).toBe(401);
  });

  it("returns a safe configuration shape for authenticated tenants", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const session = await createSessionRecord(org.user.id, org.organization.id);
    await mockSessionCookie(session.rawToken);

    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "api-user",
        password: "api-pass",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
      });

      const response = await getSmsChannelConfigRoute();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.username).toBe("api-user");
      expect(body.data.route).toBe("trans1");
      expect(JSON.stringify(body)).not.toContain("api-pass");
      expect(JSON.stringify(body)).not.toContain("enc:v1:");
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("creates and updates configuration through PUT", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const session = await createSessionRecord(org.user.id, org.organization.id);
    await mockSessionCookie(session.rawToken);

    try {
      const createResponse = await putSmsChannelConfigRoute(
        new Request("http://localhost/api/v1/channel-config/sms", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "CUSTOM_HTTP",
            username: "api-user",
            password: "api-pass",
            baseUrl: "https://sms-provider.example",
            sendPath: "/send.aspx",
            route: "trans1",
            senderId: "SENDERID",
            isActive: true,
          }),
        }),
      );
      const createBody = await createResponse.json();

      expect(createResponse.status).toBe(200);
      expect(createBody.data.provider).toBe("CUSTOM_HTTP");

      const updateResponse = await putSmsChannelConfigRoute(
        new Request("http://localhost/api/v1/channel-config/sms", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "CUSTOM_HTTP",
            username: "api-user",
            baseUrl: "https://sms-provider.example",
            sendPath: "/send.aspx",
            route: "trans2",
            senderId: "NEWSENDER",
            isActive: true,
          }),
        }),
      );
      const updateBody = await updateResponse.json();

      expect(updateResponse.status).toBe(200);
      expect(updateBody.data.route).toBe("trans2");
      expect(JSON.stringify(updateBody)).not.toContain("api-pass");
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("rejects unsupported payload keys", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const session = await createSessionRecord(org.user.id, org.organization.id);
    await mockSessionCookie(session.rawToken);

    try {
      const response = await putSmsChannelConfigRoute(
        new Request("http://localhost/api/v1/channel-config/sms", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "CUSTOM_HTTP",
            username: "api-user",
            password: "api-pass",
            baseUrl: "https://sms-provider.example",
            sendPath: "/send.aspx",
            route: "trans1",
            senderId: "SENDERID",
            requestTimeoutMs: 1,
          }),
        }),
      );

      expect(response.status).toBe(400);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("rejects invalid payloads", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const session = await createSessionRecord(org.user.id, org.organization.id);
    await mockSessionCookie(session.rawToken);

    try {
      const response = await putSmsChannelConfigRoute(
        new Request("http://localhost/api/v1/channel-config/sms", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "CUSTOM_HTTP",
            username: "",
            password: "api-pass",
            baseUrl: "https://sms-provider.example",
            sendPath: "/send.aspx",
            route: "trans1",
            senderId: "SENDERID",
          }),
        }),
      );

      expect(response.status).toBe(400);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("scopes configuration reads to the authenticated tenant", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const orgB = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const sessionB = await createSessionRecord(orgB.user.id, orgB.organization.id);
    await mockSessionCookie(sessionB.rawToken);

    try {
      await upsertSmsChannelConfig(orgA.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "org-a-user",
        password: "org-a-pass",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "ORGA",
      });

      const response = await getSmsChannelConfigRoute();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.configured).toBe(false);
    } finally {
      await cleanupOrganization(orgA.organization.id);
      await cleanupOrganization(orgB.organization.id);
    }
  });

  it("returns safe verification responses without secrets", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const session = await createSessionRecord(org.user.id, org.organization.id);
    await mockSessionCookie(session.rawToken);

    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });

      const response = await verifySmsChannelConfigRoute();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.verified).toBe(true);
      expect(body.data.walletBalanceSupported).toBe(false);
      expect(body.data.balanceCredits).toBeNull();
      expect(JSON.stringify(body)).not.toContain("password");
      expect(JSON.stringify(body)).not.toContain("enc:v1:");
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("returns TEST wallet balance metadata without provider HTTP calls", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const session = await createSessionRecord(org.user.id, org.organization.id);
    await mockSessionCookie(session.rawToken);

    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });

      const response = await getSmsChannelBalanceRoute();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.walletBalanceSupported).toBe(false);
      expect(body.data.balanceCredits).toBeNull();
      expect(body.data.message).toMatch(/test provider/i);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });
});
