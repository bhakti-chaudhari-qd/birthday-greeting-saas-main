import { Channel, ChannelProvider } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  getMessageProvider,
  isDeliveryStatusCapable,
  resolveMessageProvider,
} from "@/lib/messaging/providers";
import { testProvider } from "@/lib/messaging/providers/test-provider";
import { ProviderSendError } from "@/lib/messaging/providers/types";

import { buildSmsChannelConfigInput, withTestEncryptionKey } from "./sms-test-helpers";

describe("message provider factory", () => {
  it("rejects SMS sends when no channel config exists (no silent test-provider fallback)", () => {
    expect(() => getMessageProvider(null, Channel.SMS)).toThrow(ProviderSendError);
    expect(() => resolveMessageProvider(null, Channel.SMS)).toThrow(ProviderSendError);
  });

  it("the test provider itself remains a valid, delivery-status-capable provider (used by TEST ChannelConfig fixtures)", () => {
    expect(isDeliveryStatusCapable(testProvider)).toBe(true);
  });

  it("returns the test provider for TEST SMS channel config", () => {
    const provider = resolveMessageProvider(
      {
        id: "cfg-1",
        organizationId: "org-1",
        channel: Channel.SMS,
        provider: ChannelProvider.TEST,
        encryptedCredentials: "test-credentials",
        settings: null,
        vendorId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      Channel.SMS,
    );

    expect(provider).toBe(testProvider);
  });

  it("returns the legacy HTTP provider for CUSTOM_HTTP SMS config", async () => {
    await withTestEncryptionKey(() => {
      const input = buildSmsChannelConfigInput();
      const provider = resolveMessageProvider(
        {
          id: "cfg-1",
          organizationId: "org-1",
          channel: Channel.SMS,
          provider: input.provider,
          encryptedCredentials: input.encryptedCredentials,
          settings: input.settings,
          vendorId: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        Channel.SMS,
      );

      expect(provider.name).toBe(ChannelProvider.CUSTOM_HTTP);
    });
  });

  it("rejects unknown SMS providers", () => {
    expect(() =>
      resolveMessageProvider(
        {
          id: "cfg-1",
          organizationId: "org-1",
          channel: Channel.SMS,
          provider: ChannelProvider.TWILIO,
          encryptedCredentials: "encrypted",
          settings: null,
          vendorId: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        Channel.SMS,
      ),
    ).toThrow(ProviderSendError);
  });

  it("rejects CUSTOM_HTTP SMS config without baseUrl/sendPath", async () => {
    await withTestEncryptionKey(() => {
      expect(() =>
        resolveMessageProvider(
          {
            id: "cfg-sms-incomplete",
            organizationId: "org-1",
            channel: Channel.SMS,
            provider: ChannelProvider.CUSTOM_HTTP,
            encryptedCredentials: buildSmsChannelConfigInput().encryptedCredentials,
            settings: {
              route: "trans1",
              senderId: "SENDERID",
            },
            vendorId: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          Channel.SMS,
        ),
      ).toThrow(ProviderSendError);
    });
  });

  it("fails safely when CUSTOM_HTTP credentials cannot be decrypted", async () => {
    await withTestEncryptionKey(() => {
      expect(() =>
        resolveMessageProvider(
          {
            id: "cfg-1",
            organizationId: "org-1",
            channel: Channel.SMS,
            provider: ChannelProvider.CUSTOM_HTTP,
            encryptedCredentials: "invalid",
            settings: {
              route: "trans1",
              senderId: "SENDERID",
            },
            vendorId: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          Channel.SMS,
        ),
      ).toThrow(ProviderSendError);
    });
  });

  it("resolves WhatsApp TEST config without falling back when missing", () => {
    expect(() => resolveMessageProvider(null, Channel.WHATSAPP)).toThrow(
      ProviderSendError,
    );

    const provider = resolveMessageProvider(
      {
        id: "cfg-wa",
        organizationId: "org-1",
        channel: Channel.WHATSAPP,
        provider: ChannelProvider.TEST,
        encryptedCredentials: "test-credentials",
        settings: null,
        vendorId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      Channel.WHATSAPP,
    );

    expect(provider).toBe(testProvider);
  });

  it("returns the custom HTTP WhatsApp provider for CUSTOM_HTTP config", async () => {
    await withTestEncryptionKey(async () => {
      const { encryptCredentials } = await import("@/lib/crypto/credentials");
      const encryptedCredentials = encryptCredentials(
        JSON.stringify({ username: "wa-user", password: "" }),
      );

      const provider = resolveMessageProvider(
        {
          id: "cfg-wa-live",
          organizationId: "org-1",
          channel: Channel.WHATSAPP,
          provider: ChannelProvider.CUSTOM_HTTP,
          encryptedCredentials,
          settings: {
            baseUrl: "https://provider.example",
            sendPath: "/api/CustomAPI/CustomAPI_SendWhatsApp",
            requestTimeoutMs: 60_000,
            tlsInsecure: true,
          },
          vendorId: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        Channel.WHATSAPP,
      );

      expect(provider.name).toBe(ChannelProvider.CUSTOM_HTTP);
    });
  });

  it("rejects CUSTOM_HTTP WhatsApp config without baseUrl/sendPath", async () => {
    await withTestEncryptionKey(async () => {
      const { encryptCredentials } = await import("@/lib/crypto/credentials");
      const encryptedCredentials = encryptCredentials(
        JSON.stringify({ username: "wa-user", password: "" }),
      );

      expect(() =>
        resolveMessageProvider(
          {
            id: "cfg-wa-incomplete",
            organizationId: "org-1",
            channel: Channel.WHATSAPP,
            provider: ChannelProvider.CUSTOM_HTTP,
            encryptedCredentials,
            settings: null,
            vendorId: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          Channel.WHATSAPP,
        ),
      ).toThrow(ProviderSendError);
    });
  });

  it("rejects unsupported WhatsApp providers without SMS fallback", () => {
    expect(() =>
      resolveMessageProvider(
        {
          id: "cfg-wa",
          organizationId: "org-1",
          channel: Channel.WHATSAPP,
          provider: ChannelProvider.META,
          encryptedCredentials: "encrypted",
          settings: null,
          vendorId: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        Channel.WHATSAPP,
      ),
    ).toThrow(ProviderSendError);
  });

  it("uses Resend for EMAIL when no channel config exists", () => {
    const provider = resolveMessageProvider(null, Channel.EMAIL);
    expect(provider.name).toBe("RESEND");
  });

  it("rejects greeting email sends when Resend is not configured", async () => {
    const originalApiKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    const provider = resolveMessageProvider(null, Channel.EMAIL);

    await expect(
      provider.send({
        channel: Channel.EMAIL,
        recipient: "customer@example.com",
        subject: "Happy birthday",
        body: "Have a lovely day",
        idempotencyKey: "email-test",
        attemptNumber: 1,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_PROVIDER_CONFIG",
      message: "Email channel is not configured",
    });

    if (originalApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalApiKey;
    }
  });

  it("uses the test provider for EMAIL TEST channel config", () => {
    const provider = resolveMessageProvider(
      {
        id: "cfg-email",
        organizationId: "org-1",
        channel: Channel.EMAIL,
        provider: ChannelProvider.TEST,
        encryptedCredentials: "test-credentials",
        settings: null,
        vendorId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      Channel.EMAIL,
    );

    expect(provider).toBe(testProvider);
  });
});
