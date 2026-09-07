import { ChannelProvider } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { whatsappHttpCredentialsSchema } from "@/lib/channel-config/whatsapp-types";
import { resolveWhatsAppHttpProviderConfig } from "@/lib/channel-config/whatsapp-resolve";
import {
  getWhatsAppChannelConfig,
  upsertWhatsAppChannelConfig,
} from "@/lib/channel-config/whatsapp-service";
import { ChannelConfigValidationError } from "@/lib/channel-config/errors";
import { prisma } from "@/lib/db";
import { createRegisteredOrganization } from "@/lib/auth/register";

import { TEST_CREDENTIALS_ENCRYPTION_KEY } from "./sms-test-helpers";
import { uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registerInput(suffix: string) {
  return {
    organizationName: `WhatsApp ApiKey Org ${suffix}`,
    organizationSlug: `whatsapp-apikey-org-${suffix}`,
    timezone: "UTC",
    adminName: "WhatsApp ApiKey Admin",
    email: `whatsapp-apikey-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("whatsappHttpCredentialsSchema", () => {
  it("accepts username + password (existing CustomAPI shape)", () => {
    expect(
      whatsappHttpCredentialsSchema.safeParse({ username: "wa-user", password: "secret" })
        .success,
    ).toBe(true);
  });

  it("accepts username only (password defaults to empty)", () => {
    const result = whatsappHttpCredentialsSchema.safeParse({ username: "wa-user" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.password).toBe("");
    }
  });

  it("accepts apiKey only, with no username", () => {
    expect(
      whatsappHttpCredentialsSchema.safeParse({ apiKey: "secret-key-123" }).success,
    ).toBe(true);
  });

  it("rejects a credentials object with neither username nor apiKey", () => {
    expect(whatsappHttpCredentialsSchema.safeParse({}).success).toBe(false);
    expect(whatsappHttpCredentialsSchema.safeParse({ password: "x" }).success).toBe(
      false,
    );
  });
});

describe("WhatsApp Custom HTTP channel config: API key auth mode", () => {
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

  it("creates a Custom HTTP config with apiKey auth and reports it safely (never the key itself)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    const saved = await upsertWhatsAppChannelConfig(org.organization.id, {
      provider: ChannelProvider.CUSTOM_HTTP,
      isActive: true,
      apiKey: "secret-key-123",
      baseUrl: "https://45.114.141.55",
      sendPath: "/api/sendwb",
      tlsInsecure: true,
    });

    expect(saved.configured).toBe(true);
    expect(saved.credentialsConfigured).toBe(true);
    expect(saved.apiKeyConfigured).toBe(true);
    expect(saved.username).toBeUndefined();
    expect(saved).not.toHaveProperty("apiKey");
    expect(saved).not.toHaveProperty("encryptedCredentials");
    expect(JSON.stringify(saved)).not.toContain("secret-key-123");

    const channelConfig = await prisma.channelConfig.findUniqueOrThrow({
      where: {
        organizationId_channel: { organizationId: org.organization.id, channel: "WHATSAPP" },
      },
    });
    const resolved = resolveWhatsAppHttpProviderConfig(channelConfig);
    expect(resolved.apiKey).toBe("secret-key-123");
    expect(resolved.username).toBeUndefined();
    expect(resolved.baseUrl).toBe("https://45.114.141.55");
    expect(resolved.sendPath).toBe("/api/sendwb");

    await cleanupOrganization(org.organization.id);
  });

  it("creates a Custom HTTP config with username/password auth (existing behavior unchanged)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    const saved = await upsertWhatsAppChannelConfig(org.organization.id, {
      provider: ChannelProvider.CUSTOM_HTTP,
      isActive: true,
      username: "wa-user",
      password: "wa-pass",
      baseUrl: "https://provider.example",
      sendPath: "/api/CustomAPI/CustomAPI_SendWhatsApp",
      tlsInsecure: true,
    });

    expect(saved.credentialsConfigured).toBe(true);
    expect(saved.apiKeyConfigured).toBe(false);
    expect(saved.username).toBe("wa-user");

    await cleanupOrganization(org.organization.id);
  });

  it("rejects creating a Custom HTTP config with neither username nor apiKey", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    await expect(
      upsertWhatsAppChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        isActive: true,
        baseUrl: "https://provider.example",
        sendPath: "/api/sendwb",
      }),
    ).rejects.toBeInstanceOf(ChannelConfigValidationError);

    await cleanupOrganization(org.organization.id);
  });

  it("preserves the existing apiKey when a later save omits it (edit-without-resending UX)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    await upsertWhatsAppChannelConfig(org.organization.id, {
      provider: ChannelProvider.CUSTOM_HTTP,
      isActive: true,
      apiKey: "secret-key-123",
      baseUrl: "https://45.114.141.55",
      sendPath: "/api/sendwb",
    });

    // Only flips tlsInsecure - does not resend apiKey.
    const updated = await upsertWhatsAppChannelConfig(org.organization.id, {
      provider: ChannelProvider.CUSTOM_HTTP,
      isActive: true,
      baseUrl: "https://45.114.141.55",
      sendPath: "/api/sendwb",
      tlsInsecure: false,
    });

    expect(updated.apiKeyConfigured).toBe(true);
    expect(updated.tlsInsecure).toBe(false);

    const channelConfig = await prisma.channelConfig.findUniqueOrThrow({
      where: {
        organizationId_channel: { organizationId: org.organization.id, channel: "WHATSAPP" },
      },
    });
    expect(resolveWhatsAppHttpProviderConfig(channelConfig).apiKey).toBe(
      "secret-key-123",
    );

    await cleanupOrganization(org.organization.id);
  });

  it("switches an existing username/password config to apiKey mode when apiKey is provided", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    await upsertWhatsAppChannelConfig(org.organization.id, {
      provider: ChannelProvider.CUSTOM_HTTP,
      isActive: true,
      username: "wa-user",
      password: "wa-pass",
      baseUrl: "https://provider.example",
      sendPath: "/api/CustomAPI/CustomAPI_SendWhatsApp",
    });

    const switched = await upsertWhatsAppChannelConfig(org.organization.id, {
      provider: ChannelProvider.CUSTOM_HTTP,
      isActive: true,
      apiKey: "new-key-456",
      baseUrl: "https://45.114.141.55",
      sendPath: "/api/sendwb",
    });

    expect(switched.apiKeyConfigured).toBe(true);
    expect(switched.username).toBeUndefined();

    const channelConfig = await prisma.channelConfig.findUniqueOrThrow({
      where: {
        organizationId_channel: { organizationId: org.organization.id, channel: "WHATSAPP" },
      },
    });
    const resolved = resolveWhatsAppHttpProviderConfig(channelConfig);
    expect(resolved.apiKey).toBe("new-key-456");
    expect(resolved.username).toBeUndefined();

    await cleanupOrganization(org.organization.id);
  });

  it("reads back through getWhatsAppChannelConfig consistently with upsert's return value", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    await upsertWhatsAppChannelConfig(org.organization.id, {
      provider: ChannelProvider.CUSTOM_HTTP,
      isActive: true,
      apiKey: "secret-key-123",
      baseUrl: "https://45.114.141.55",
      sendPath: "/api/sendwb",
    });

    const reloaded = await getWhatsAppChannelConfig(org.organization.id);
    expect(reloaded.apiKeyConfigured).toBe(true);
    expect(reloaded.credentialsConfigured).toBe(true);
    expect(JSON.stringify(reloaded)).not.toContain("secret-key-123");

    await cleanupOrganization(org.organization.id);
  });
});
