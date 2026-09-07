import { describe, expect, it } from "vitest";

import {
  decryptCredentials,
  encryptCredentials,
  isEncryptedCredentials,
} from "@/lib/crypto/credentials";

import {
  TEST_CREDENTIALS_ENCRYPTION_KEY,
  withTestEncryptionKey,
} from "./sms-test-helpers";

describe("credential encryption", () => {
  it("encrypts and decrypts credential payloads", async () => {
    await withTestEncryptionKey(() => {
      const encrypted = encryptCredentials(
        JSON.stringify({ username: "user", password: "secret" }),
      );

      expect(isEncryptedCredentials(encrypted)).toBe(true);
      expect(decryptCredentials(encrypted)).toBe(
        JSON.stringify({ username: "user", password: "secret" }),
      );
    });
  });

  it("requires a 32-byte encryption key", () => {
    const previous = process.env.CREDENTIALS_ENCRYPTION_KEY;
    process.env.CREDENTIALS_ENCRYPTION_KEY = "short-key";

    try {
      expect(() => encryptCredentials("secret")).toThrow(
        "CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
      );
    } finally {
      if (previous === undefined) {
        delete process.env.CREDENTIALS_ENCRYPTION_KEY;
      } else {
        process.env.CREDENTIALS_ENCRYPTION_KEY = previous;
      }
    }
  });

  it("uses the test encryption key helper", () => {
    expect(TEST_CREDENTIALS_ENCRYPTION_KEY.length).toBeGreaterThan(0);
  });
});
