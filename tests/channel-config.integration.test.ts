import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Channel, ChannelProvider } from "@prisma/client";

import {
  decryptCredentials,
  isEncryptedCredentials,
} from "@/lib/crypto/credentials";
import { createRegisteredOrganization } from "@/lib/auth/register";
import {
  getSmsChannelConfig,
  upsertSmsChannelConfig,
  verifySmsChannelConfig,
} from "@/lib/channel-config/service";
import { smsCredentialsSchema } from "@/lib/channel-config/types";
import { isTestProviderStorageCredentialUsername } from "@/lib/channel-config/test-provider-storage";
import { prisma } from "@/lib/db";
import {
  TEST_CREDENTIALS_ENCRYPTION_KEY,
} from "./sms-test-helpers";
import {
  indianProviderFailMobile,
  uniqueIndianMobile as testMobile,
  uniqueSuffix,
} from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registerInput(suffix: string) {
  return {
    organizationName: `Channel Config Org ${suffix}`,
    organizationSlug: `channel-config-org-${suffix}`,
    timezone: "UTC",
    adminName: "Channel Admin",
    email: `channel-config-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("SMS channel configuration service", () => {
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

  it("returns not configured for a tenant without SMS channel config", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      const view = await getSmsChannelConfig(org.organization.id);
      expect(view.configured).toBe(false);
      expect(view.provider).toBeNull();
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("creates TEST configuration without real provider credentials", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      const saved = await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });

      expect(saved.configured).toBe(true);
      expect(saved.provider).toBe(ChannelProvider.TEST);
      expect(saved.credentialsConfigured).toBe(false);
      expect(saved.username).toBeUndefined();
      expect(saved.route).toBeUndefined();

      const stored = await prisma.channelConfig.findUniqueOrThrow({
        where: {
          organizationId_channel: {
            organizationId: org.organization.id,
            channel: Channel.SMS,
          },
        },
      });

      expect(stored.provider).toBe(ChannelProvider.TEST);
      expect(isEncryptedCredentials(stored.encryptedCredentials)).toBe(true);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("creates CUSTOM_HTTP configuration with encrypted credentials", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      const saved = await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "tenant-user",
        password: "tenant-pass",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
        isActive: true,
      });

      expect(saved.provider).toBe(ChannelProvider.CUSTOM_HTTP);
      expect(saved.username).toBe("tenant-user");
      expect(saved.route).toBe("trans1");
      expect(saved.senderId).toBe("SENDERID");
      expect(saved.credentialsConfigured).toBe(true);

      const stored = await prisma.channelConfig.findUniqueOrThrow({
        where: {
          organizationId_channel: {
            organizationId: org.organization.id,
            channel: Channel.SMS,
          },
        },
      });

      expect(stored.encryptedCredentials).not.toContain("tenant-pass");
      expect(isEncryptedCredentials(stored.encryptedCredentials)).toBe(true);

      const decrypted = smsCredentialsSchema.parse(
        JSON.parse(decryptCredentials(stored.encryptedCredentials)),
      );
      expect(decrypted.username).toBe("tenant-user");
      expect(decrypted.password).toBe("tenant-pass");

      const settings = stored.settings as Record<string, unknown>;
      expect(settings.route).toBe("trans1");
      expect(settings.senderId).toBe("SENDERID");
      expect(settings.baseUrl).toBe("https://sms-provider.example");
      expect(settings.sendPath).toBe("/send.aspx");
      expect(settings.requestTimeoutMs).toBe(30_000);
      expect(settings.successStatusCode).toBe(1);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("requires password when creating CUSTOM_HTTP configuration", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      await expect(
        upsertSmsChannelConfig(org.organization.id, {
          provider: ChannelProvider.CUSTOM_HTTP,
          username: "tenant-user",
          baseUrl: "https://sms-provider.example",
          sendPath: "/send.aspx",
          route: "trans1",
          senderId: "SENDERID",
        }),
      ).rejects.toThrow(/password/i);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("never returns password or ciphertext in the safe view", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "tenant-user",
        password: "tenant-pass",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
      });

      const view = await getSmsChannelConfig(org.organization.id);
      const serialized = JSON.stringify(view);

      expect(serialized).not.toContain("tenant-pass");
      expect(serialized).not.toContain("enc:v1:");
      expect(view.username).toBe("tenant-user");
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("preserves password when editing with a blank password", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "tenant-user",
        password: "original-pass",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
      });

      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "tenant-user",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans2",
        senderId: "NEWSENDER",
      });

      const stored = await prisma.channelConfig.findUniqueOrThrow({
        where: {
          organizationId_channel: {
            organizationId: org.organization.id,
            channel: Channel.SMS,
          },
        },
      });

      const decrypted = smsCredentialsSchema.parse(
        JSON.parse(decryptCredentials(stored.encryptedCredentials)),
      );
      expect(decrypted.password).toBe("original-pass");

      const settings = stored.settings as Record<string, unknown>;
      expect(settings.route).toBe("trans2");
      expect(settings.senderId).toBe("NEWSENDER");
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("replaces password when a new password is provided", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "tenant-user",
        password: "original-pass",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
      });

      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "tenant-user",
        password: "new-pass",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
      });

      const stored = await prisma.channelConfig.findUniqueOrThrow({
        where: {
          organizationId_channel: {
            organizationId: org.organization.id,
            channel: Channel.SMS,
          },
        },
      });

      const decrypted = smsCredentialsSchema.parse(
        JSON.parse(decryptCredentials(stored.encryptedCredentials)),
      );
      expect(decrypted.password).toBe("new-pass");
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("preserves password when username changes and password is blank", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "tenant-user",
        password: "original-pass",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
      });

      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "renamed-user",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
      });

      const stored = await prisma.channelConfig.findUniqueOrThrow({
        where: {
          organizationId_channel: {
            organizationId: org.organization.id,
            channel: Channel.SMS,
          },
        },
      });

      const decrypted = smsCredentialsSchema.parse(
        JSON.parse(decryptCredentials(stored.encryptedCredentials)),
      );
      expect(decrypted.username).toBe("renamed-user");
      expect(decrypted.password).toBe("original-pass");
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("keeps tenant configurations isolated", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const orgB = await createRegisteredOrganization(registerInput(uniqueSuffix()));

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

      const viewB = await getSmsChannelConfig(orgB.organization.id);
      expect(viewB.configured).toBe(false);

      const viewA = await getSmsChannelConfig(orgA.organization.id);
      expect(viewA.username).toBe("org-a-user");
      expect(viewA.route).toBe("trans1");
    } finally {
      await cleanupOrganization(orgA.organization.id);
      await cleanupOrganization(orgB.organization.id);
    }
  });

  it("clears provider credentials and settings when switching to TEST", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "tenant-user",
        password: "preserve-me",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
      });

      const before = await prisma.channelConfig.findUniqueOrThrow({
        where: {
          organizationId_channel: {
            organizationId: org.organization.id,
            channel: Channel.SMS,
          },
        },
      });

      const saved = await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });

      const after = await prisma.channelConfig.findUniqueOrThrow({
        where: {
          organizationId_channel: {
            organizationId: org.organization.id,
            channel: Channel.SMS,
          },
        },
      });

      expect(after.provider).toBe(ChannelProvider.TEST);
      expect(after.encryptedCredentials).not.toBe(before.encryptedCredentials);
      expect(after.settings).toBeNull();
      expect(saved.credentialsConfigured).toBe(false);
      expect(saved.username).toBeUndefined();
      expect(saved.route).toBeUndefined();

      const decrypted = smsCredentialsSchema.parse(
        JSON.parse(decryptCredentials(after.encryptedCredentials)),
      );
      expect(isTestProviderStorageCredentialUsername(decrypted.username)).toBe(
        true,
      );
      expect(decrypted.password).not.toBe("preserve-me");
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("requires fresh CUSTOM_HTTP credentials after switching from TEST", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "tenant-user",
        password: "original-pass",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
      });

      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });

      await expect(
        upsertSmsChannelConfig(org.organization.id, {
          provider: ChannelProvider.CUSTOM_HTTP,
          username: "tenant-user",
          baseUrl: "https://sms-provider.example",
          sendPath: "/send.aspx",
          route: "trans1",
          senderId: "SENDERID",
        }),
      ).rejects.toThrow(/password/i);

      const saved = await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "tenant-user",
        password: "new-pass",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
      });

      expect(saved.credentialsConfigured).toBe(true);

      const stored = await prisma.channelConfig.findUniqueOrThrow({
        where: {
          organizationId_channel: {
            organizationId: org.organization.id,
            channel: Channel.SMS,
          },
        },
      });

      const decrypted = smsCredentialsSchema.parse(
        JSON.parse(decryptCredentials(stored.encryptedCredentials)),
      );
      expect(decrypted.password).toBe("new-pass");
      expect(decrypted.password).not.toBe("original-pass");
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("treats whitespace-only password as blank during CUSTOM_HTTP edit", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "tenant-user",
        password: "original-pass",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
      });

      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "tenant-user",
        password: "   ",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
      });

      const stored = await prisma.channelConfig.findUniqueOrThrow({
        where: {
          organizationId_channel: {
            organizationId: org.organization.id,
            channel: Channel.SMS,
          },
        },
      });

      const decrypted = smsCredentialsSchema.parse(
        JSON.parse(decryptCredentials(stored.encryptedCredentials)),
      );
      expect(decrypted.password).toBe("original-pass");
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("verifies persisted CUSTOM_HTTP configuration rather than unsaved values", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "saved-user",
        password: "saved-pass",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
      });

      let observedUsername: string | undefined;
      await verifySmsChannelConfig(org.organization.id, {
        fetchFn: async (input) => {
          const url = new URL(String(input));
          observedUsername = url.searchParams.get("username") ?? undefined;
          return new Response("1|100", { status: 200 });
        },
      });

      expect(observedUsername).toBe("saved-user");
      expect(observedUsername).not.toBe("unsaved-user");
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("prevents duplicate SMS channel configuration records per tenant", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });

      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "tenant-user",
        password: "tenant-pass",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
      });

      const configs = await prisma.channelConfig.findMany({
        where: {
          organizationId: org.organization.id,
          channel: Channel.SMS,
        },
      });

      expect(configs).toHaveLength(1);
      expect(configs[0]?.provider).toBe(ChannelProvider.CUSTOM_HTTP);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("stores tenant baseUrl, sendPath, and server timeout for CUSTOM_HTTP", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "tenant-user",
        password: "tenant-pass",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
      });

      const stored = await prisma.channelConfig.findUniqueOrThrow({
        where: {
          organizationId_channel: {
            organizationId: org.organization.id,
            channel: Channel.SMS,
          },
        },
      });

      const settings = stored.settings as Record<string, unknown>;
      expect(settings.baseUrl).toBe("https://sms-provider.example");
      expect(settings.sendPath).toBe("/send.aspx");
      expect(settings.requestTimeoutMs).toBe(30_000);
      expect(settings.successStatusCode).toBe(1);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("verifies TEST configuration without provider HTTP calls", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });

      const result = await verifySmsChannelConfig(org.organization.id, {
        fetchFn: async () => {
          throw new Error("Provider HTTP must not be called for TEST verification");
        },
      });

      expect(result.verified).toBe(true);
      expect(result.provider).toBe(ChannelProvider.TEST);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("verifies CUSTOM_HTTP using balance lookup without sending SMS", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "tenant-user",
        password: "tenant-pass",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
      });

      const fetchCalls: string[] = [];
      const result = await verifySmsChannelConfig(org.organization.id, {
        fetchFn: async (input) => {
          fetchCalls.push(String(input));
          return new Response("1|100", { status: 200 });
        },
      });

      expect(result.verified).toBe(true);
      expect(result.balanceCredits).toBe(100);
      expect(result.walletBalanceSupported).toBe(true);
      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0]).toContain("/balance.aspx");
      expect(fetchCalls[0]).not.toContain("send.aspx");
      expect(JSON.stringify(result)).not.toContain("tenant-pass");
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("rejects CUSTOM_HTTP verification for invalid credentials", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "tenant-user",
        password: "tenant-pass",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
      });

      await expect(
        verifySmsChannelConfig(org.organization.id, {
          fetchFn: async () => new Response("2|0", { status: 200 }),
        }),
      ).rejects.toThrow(/invalid/i);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });

  it("does not create queue or delivery records during verification", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    try {
      await upsertSmsChannelConfig(org.organization.id, {
        provider: ChannelProvider.CUSTOM_HTTP,
        username: "tenant-user",
        password: "tenant-pass",
        baseUrl: "https://sms-provider.example",
        sendPath: "/send.aspx",
        route: "trans1",
        senderId: "SENDERID",
      });

      const queueBefore = await prisma.sendQueue.count({
        where: { organizationId: org.organization.id },
      });
      const deliveryBefore = await prisma.deliveryLog.count({
        where: { organizationId: org.organization.id },
      });

      await verifySmsChannelConfig(org.organization.id, {
        fetchFn: async () => new Response("1|100", { status: 200 }),
      });

      const queueAfter = await prisma.sendQueue.count({
        where: { organizationId: org.organization.id },
      });
      const deliveryAfter = await prisma.deliveryLog.count({
        where: { organizationId: org.organization.id },
      });

      expect(queueAfter).toBe(queueBefore);
      expect(deliveryAfter).toBe(deliveryBefore);
    } finally {
      await cleanupOrganization(org.organization.id);
    }
  });
});
