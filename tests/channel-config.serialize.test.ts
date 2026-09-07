import { Channel, ChannelProvider } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { serializeSmsChannelConfig } from "@/lib/channel-config/serialize";

import {
  TEST_SMS_HTTP_BASE_URL,
  TEST_SMS_HTTP_SEND_PATH,
  buildEncryptedSmsCredentials,
  withTestEncryptionKey,
} from "./sms-test-helpers";

describe("serializeSmsChannelConfig", () => {
  it("does not expose provider-specific fields for TEST", async () => {
    await withTestEncryptionKey(() => {
      const view = serializeSmsChannelConfig({
        id: "cfg-1",
        organizationId: "org-1",
        channel: Channel.SMS,
        provider: ChannelProvider.TEST,
        encryptedCredentials: buildEncryptedSmsCredentials({
          username: "__test_provider__",
          password: "__test_provider__",
        }),
        settings: {
          baseUrl: TEST_SMS_HTTP_BASE_URL,
          sendPath: TEST_SMS_HTTP_SEND_PATH,
          route: "trans1",
          senderId: "SENDERID",
          requestTimeoutMs: 10_000,
          successStatusCode: 1,
        },
        vendorId: null,
        isActive: true,
        createdAt: new Date("2026-07-11T10:00:00.000Z"),
        updatedAt: new Date("2026-07-11T11:00:00.000Z"),
      });

      expect(view.credentialsConfigured).toBe(false);
      expect(view.username).toBeUndefined();
      expect(view.baseUrl).toBeUndefined();
      expect(view.sendPath).toBeUndefined();
      expect(view.route).toBeUndefined();
      expect(view.senderId).toBeUndefined();
      expect(view.walletBalanceSupported).toBe(false);
      expect(JSON.stringify(view)).not.toContain("requestTimeoutMs");
      expect(JSON.stringify(view)).not.toContain("enc:v1:");
    });
  });

  it("reports CUSTOM_HTTP credentialsConfigured accurately", async () => {
    await withTestEncryptionKey(() => {
      const view = serializeSmsChannelConfig({
        id: "cfg-2",
        organizationId: "org-1",
        channel: Channel.SMS,
        provider: ChannelProvider.CUSTOM_HTTP,
        encryptedCredentials: buildEncryptedSmsCredentials({
          username: "tenant-user",
          password: "tenant-pass",
        }),
        settings: {
          baseUrl: TEST_SMS_HTTP_BASE_URL,
          sendPath: TEST_SMS_HTTP_SEND_PATH,
          route: "trans1",
          senderId: "SENDERID",
          requestTimeoutMs: 10_000,
          successStatusCode: 1,
        },
        vendorId: null,
        isActive: true,
        createdAt: new Date("2026-07-11T10:00:00.000Z"),
        updatedAt: new Date("2026-07-11T11:00:00.000Z"),
      });

      expect(view.credentialsConfigured).toBe(true);
      expect(view.username).toBe("tenant-user");
      expect(view.baseUrl).toBe(TEST_SMS_HTTP_BASE_URL);
      expect(view.sendPath).toBe(TEST_SMS_HTTP_SEND_PATH);
      expect(view.route).toBe("trans1");
      expect(view.requestTimeoutMs).toBe(10_000);
      expect(view.successStatusCode).toBe(1);
      expect(view.walletBalanceSupported).toBe(true);
      expect(JSON.stringify(view)).not.toContain("tenant-pass");
    });
  });
});
