import { ChannelProvider } from "@prisma/client";

import { encryptCredentials } from "@/lib/crypto/credentials";
import type { SmsCredentials, SmsSettings } from "@/lib/channel-config/types";

export const TEST_CREDENTIALS_ENCRYPTION_KEY =
  "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=";

/** Example Custom HTTP SMS endpoint used in tests - not a product default. */
export const TEST_SMS_HTTP_BASE_URL = "https://sms-provider.example";
export const TEST_SMS_HTTP_SEND_PATH = "/send.aspx";

function applyTestEncryptionKey() {
  const previous = process.env.CREDENTIALS_ENCRYPTION_KEY;
  process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_CREDENTIALS_ENCRYPTION_KEY;
  return previous;
}

function restoreEncryptionKey(previous: string | undefined) {
  if (previous === undefined) {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
  } else {
    process.env.CREDENTIALS_ENCRYPTION_KEY = previous;
  }
}

export async function withTestEncryptionKey<T>(
  run: () => T | Promise<T>,
): Promise<T> {
  const previous = applyTestEncryptionKey();

  try {
    return await run();
  } finally {
    restoreEncryptionKey(previous);
  }
}

export function buildEncryptedSmsCredentials(credentials: SmsCredentials) {
  const previous = applyTestEncryptionKey();

  try {
    return encryptCredentials(JSON.stringify(credentials));
  } finally {
    restoreEncryptionKey(previous);
  }
}

export function buildSmsChannelConfigInput(options?: {
  credentials?: SmsCredentials;
  settings?: SmsSettings;
  provider?: ChannelProvider;
}) {
  const credentials = options?.credentials ?? {
    username: "sms-user",
    password: "sms-pass",
  };

  const settings = options?.settings ?? {
    baseUrl: TEST_SMS_HTTP_BASE_URL,
    sendPath: TEST_SMS_HTTP_SEND_PATH,
    route: "trans1",
    senderId: "SENDERID",
    requestTimeoutMs: 10_000,
  };

  return {
    provider: options?.provider ?? ChannelProvider.CUSTOM_HTTP,
    encryptedCredentials: buildEncryptedSmsCredentials(credentials),
    settings,
    isActive: true,
  };
}

/** Fields required for upsertSmsChannelConfig CUSTOM_HTTP in tests. */
export function testCustomHttpSmsWriteFields(
  overrides: {
    username?: string;
    password?: string;
    baseUrl?: string;
    sendPath?: string;
    route?: string;
    senderId?: string;
    isActive?: boolean;
  } = {},
) {
  return {
    username: overrides.username ?? "sms-user",
    password: overrides.password ?? "sms-pass",
    baseUrl: overrides.baseUrl ?? TEST_SMS_HTTP_BASE_URL,
    sendPath: overrides.sendPath ?? TEST_SMS_HTTP_SEND_PATH,
    route: overrides.route ?? "trans1",
    senderId: overrides.senderId ?? "SENDERID",
    ...(overrides.isActive === undefined ? {} : { isActive: overrides.isActive }),
  };
}
