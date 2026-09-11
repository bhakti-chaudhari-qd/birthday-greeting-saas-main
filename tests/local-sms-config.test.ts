import { Channel, ChannelProvider } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildLocalSmsChannelConfig,
  isEncryptedStoredCredentials,
  LOCAL_SMS_PROVIDER_SETTINGS,
  LocalSmsConfigError,
  readLocalSmsEnv,
} from "@/lib/channel-config/local-sms-config";

import { TEST_CREDENTIALS_ENCRYPTION_KEY } from "./sms-test-helpers";

describe("local SMS channel configuration", () => {
  it("requires SMS credentials, base URL, and target organization env vars", () => {
    expect(() => readLocalSmsEnv({})).toThrow(LocalSmsConfigError);
    expect(() =>
      readLocalSmsEnv({
        SMS_USERNAME: "user",
        SMS_PASSWORD: "pass",
        CREDENTIALS_ENCRYPTION_KEY: TEST_CREDENTIALS_ENCRYPTION_KEY,
        SMS_CONFIG_ORGANIZATION_SLUG: "acme-corp",
      }),
    ).toThrow(/SMS_BASE_URL/i);
    expect(() =>
      readLocalSmsEnv({
        SMS_USERNAME: "user",
        SMS_PASSWORD: "pass",
        CREDENTIALS_ENCRYPTION_KEY: TEST_CREDENTIALS_ENCRYPTION_KEY,
        SMS_BASE_URL: "https://sms-provider.example",
      }),
    ).toThrow(/organization/i);
    expect(() =>
      readLocalSmsEnv({
        SMS_USERNAME: "user",
        SMS_PASSWORD: "pass",
        CREDENTIALS_ENCRYPTION_KEY: TEST_CREDENTIALS_ENCRYPTION_KEY,
        SMS_BASE_URL: "https://sms-provider.example",
        SMS_CONFIG_ORGANIZATION_ID: "org-1",
        SMS_CONFIG_ORGANIZATION_SLUG: "acme-corp",
      }),
    ).toThrow(/only one/i);
  });

  it("builds encrypted CUSTOM_HTTP channel config with tenant endpoint settings", () => {
    const config = buildLocalSmsChannelConfig({
      smsUsername: "sms-user",
      smsPassword: "sms-pass",
      credentialsEncryptionKey: TEST_CREDENTIALS_ENCRYPTION_KEY,
      smsBaseUrl: LOCAL_SMS_PROVIDER_SETTINGS.baseUrl,
      smsSendPath: LOCAL_SMS_PROVIDER_SETTINGS.sendPath,
      smsRoute: LOCAL_SMS_PROVIDER_SETTINGS.route,
      smsSenderId: LOCAL_SMS_PROVIDER_SETTINGS.senderId,
      organizationSlug: "acme-corp",
    });

    expect(config.channel).toBe(Channel.SMS);
    expect(config.provider).toBe(ChannelProvider.CUSTOM_HTTP);
    expect(config.settings).toEqual({
      ...LOCAL_SMS_PROVIDER_SETTINGS,
      successStatusCode: 1,
    });
    expect(isEncryptedStoredCredentials(config.encryptedCredentials)).toBe(
      true,
    );
    expect(config.encryptedCredentials).not.toContain("sms-pass");
  });
});
