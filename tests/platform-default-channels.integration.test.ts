import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Channel, ChannelProvider } from "@prisma/client";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { encryptCredentials } from "@/lib/crypto/credentials";
import { getEmailChannelConfig } from "@/lib/channel-config/email-service";
import {
  getEffectiveChannelConfig,
  getPlatformDefaultWhatsAppConfig,
  readPlatformDefaultSms,
  readPlatformDefaultWhatsApp,
} from "@/lib/channel-config/platform-defaults";
import { resolveSmsProviderConfig } from "@/lib/channel-config/resolve";
import { getSmsChannelConfig } from "@/lib/channel-config/service";
import { resolveWhatsAppHttpProviderConfig } from "@/lib/channel-config/whatsapp-resolve";
import { resolveMessageProvider } from "@/lib/messaging/providers/factory";
import { prisma } from "@/lib/db";
import { uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

const DEFAULT_SMS_ENV = {
  DEFAULT_SMS_BASE_URL: "https://sms.platform.example",
  DEFAULT_SMS_SEND_PATH: "/send.aspx",
  DEFAULT_SMS_USERNAME: "platform-user",
  DEFAULT_SMS_PASSWORD: "platform-secret",
  DEFAULT_SMS_ROUTE: "trans1",
  DEFAULT_SMS_SENDER_ID: "PLATFM",
};

function stubDefaultSms() {
  for (const [key, value] of Object.entries(DEFAULT_SMS_ENV)) {
    vi.stubEnv(key, value);
  }
  // Enforce the live-send gate (it is skipped under test by default).
  vi.stubEnv("ABUSE_ENFORCE_LIVE_GATES", "1");
}

async function createOrg() {
  const suffix = uniqueSuffix();
  const org = await createRegisteredOrganization({
    organizationName: `Default SMS ${suffix}`,
    organizationSlug: `default-sms-${suffix}`,
    timezone: "Asia/Kolkata",
    adminName: "Owner",
    email: `default-sms-${suffix}@test.local`,
    password: "password12345",
  });
  return org.organization.id;
}

describe("readPlatformDefaultSms", () => {
  it("returns the gateway only when every value is present and valid", () => {
    expect(readPlatformDefaultSms({ ...DEFAULT_SMS_ENV } as NodeJS.ProcessEnv)).toMatchObject({
      baseUrl: "https://sms.platform.example",
      username: "platform-user",
      senderId: "PLATFM",
    });

    for (const key of Object.keys(DEFAULT_SMS_ENV)) {
      const partial = { ...DEFAULT_SMS_ENV, [key]: "" } as NodeJS.ProcessEnv;
      expect(readPlatformDefaultSms(partial)).toBeNull();
    }
  });

  it("rejects a send path without a leading slash and a non-http base URL", () => {
    expect(
      readPlatformDefaultSms({ ...DEFAULT_SMS_ENV, DEFAULT_SMS_SEND_PATH: "send" } as NodeJS.ProcessEnv),
    ).toBeNull();
    expect(
      readPlatformDefaultSms({
        ...DEFAULT_SMS_ENV,
        DEFAULT_SMS_BASE_URL: "ftp://sms.platform.example",
      } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("accepts a plain http gateway in production", () => {
    expect(
      readPlatformDefaultSms({
        ...DEFAULT_SMS_ENV,
        DEFAULT_SMS_BASE_URL: "http://sms.platform.example",
        NODE_ENV: "production",
      } as NodeJS.ProcessEnv),
    ).toMatchObject({ baseUrl: "http://sms.platform.example" });
  });
});

describe("platform default WhatsApp (Koverage)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off unless both the vendor UID and API token are set", () => {
    expect(readPlatformDefaultWhatsApp({} as NodeJS.ProcessEnv)).toBeNull();
    expect(
      readPlatformDefaultWhatsApp({
        DEFAULT_WHATSAPP_KOVERAGE_VENDOR_UID: "vendor-uid-1",
      } as unknown as NodeJS.ProcessEnv),
    ).toBeNull();
    expect(
      readPlatformDefaultWhatsApp({
        DEFAULT_WHATSAPP_KOVERAGE_VENDOR_UID: "vendor-uid-1",
        DEFAULT_WHATSAPP_KOVERAGE_API_TOKEN: "platform-token",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({
      baseUrl: "https://waba.koverage.in",
      sendPath: "/api/vendor-uid-1/contact/send-template-message",
      apiToken: "platform-token",
    });
  });

  it("resolves to a Koverage gateway config the send pipeline accepts", async () => {
    vi.stubEnv("DEFAULT_WHATSAPP_KOVERAGE_VENDOR_UID", "vendor-uid-1");
    vi.stubEnv("DEFAULT_WHATSAPP_KOVERAGE_API_TOKEN", "platform-token");

    const config = await getPlatformDefaultWhatsAppConfig("org-1");

    expect(config).toMatchObject({
      channel: Channel.WHATSAPP,
      provider: ChannelProvider.CUSTOM_HTTP,
      isActive: true,
    });
    expect(resolveWhatsAppHttpProviderConfig(config!)).toMatchObject({
      apiFormat: "KOVERAGE",
      baseUrl: "https://waba.koverage.in",
      sendPath: "/api/vendor-uid-1/contact/send-template-message",
      apiKey: "platform-token",
    });
    expect(resolveMessageProvider(config, Channel.WHATSAPP).name).toBe("KOVERAGE");
  });
});

describe("platform default channels", () => {
  beforeAll(async () => {
    if (!databaseUrl) return;
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("offers the platform gateway to a newly registered free client with no gateway of its own", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();
    stubDefaultSms();
    const organizationId = await createOrg();

    const config = await getEffectiveChannelConfig(organizationId, Channel.SMS);
    expect(config).not.toBeNull();
    expect(config).toMatchObject({
      channel: Channel.SMS,
      provider: ChannelProvider.CUSTOM_HTTP,
      isActive: true,
    });
    expect(resolveSmsProviderConfig(config!)).toMatchObject({
      baseUrl: "https://sms.platform.example",
      sendPath: "/send.aspx",
      username: "platform-user",
      password: "platform-secret",
      senderId: "PLATFM",
    });

    const view = await getSmsChannelConfig(organizationId);
    expect(view.usingPlatformDefault).toBe(true);
    expect(view.configured).toBe(false);
    // Platform credentials never reach the client's settings view.
    expect(JSON.stringify(view)).not.toContain("platform-secret");
    expect(JSON.stringify(view)).not.toContain("platform-user");

    expect(await prisma.channelConfig.count({ where: { organizationId } })).toBe(0);

    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("turns the default off when the platform gateway is not configured", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();
    vi.stubEnv("ABUSE_ENFORCE_LIVE_GATES", "1");
    const organizationId = await createOrg();
    await prisma.organization.update({
      where: { id: organizationId },
      data: { liveChannelsApproved: true },
    });

    expect(await getEffectiveChannelConfig(organizationId, Channel.SMS)).toBeNull();

    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("prefers the client's own gateway, and never falls back when the client switched SMS off", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();
    stubDefaultSms();
    const organizationId = await createOrg();
    await prisma.organization.update({
      where: { id: organizationId },
      data: { liveChannelsApproved: true },
    });
    const own = await prisma.channelConfig.create({
      data: {
        organizationId,
        channel: Channel.SMS,
        provider: ChannelProvider.TEST,
        encryptedCredentials: encryptCredentials(
          JSON.stringify({ username: "own", password: "own" }),
        ),
        isActive: true,
      },
    });

    expect((await getEffectiveChannelConfig(organizationId, Channel.SMS))?.id).toBe(own.id);

    await prisma.channelConfig.update({
      where: { id: own.id },
      data: { isActive: false },
    });
    expect(await getEffectiveChannelConfig(organizationId, Channel.SMS)).toBeNull();

    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("has no WhatsApp default while the Koverage account is not configured", async ({ skip }) => {
    if (!databaseAvailable) skip();
    stubDefaultSms();
    const organizationId = await createOrg();
    await prisma.organization.update({
      where: { id: organizationId },
      data: { liveChannelsApproved: true },
    });

    expect(await getEffectiveChannelConfig(organizationId, Channel.WHATSAPP)).toBeNull();

    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("reports the platform email sender only while the client has none of its own", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();
    const organizationId = await createOrg();

    vi.stubEnv("RESEND_API_KEY", "");
    expect((await getEmailChannelConfig(organizationId)).platformDefaultFrom).toBeNull();

    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "Greetings <hello@platform.example>");
    expect((await getEmailChannelConfig(organizationId)).platformDefaultFrom).toBe(
      "Greetings <hello@platform.example>",
    );

    await prisma.channelConfig.create({
      data: {
        organizationId,
        channel: Channel.EMAIL,
        provider: ChannelProvider.TEST,
        encryptedCredentials: encryptCredentials(JSON.stringify({})),
        isActive: true,
      },
    });
    expect(
      (await getEmailChannelConfig(organizationId)).platformDefaultFrom,
    ).toBeUndefined();

    await prisma.organization.delete({ where: { id: organizationId } });
  });
});
