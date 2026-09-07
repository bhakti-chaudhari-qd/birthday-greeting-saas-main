import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTION_PREFIX = "enc:v1:";

function getEncryptionKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY is required to encrypt credentials");
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
    );
  }

  return key;
}

export function encryptCredentials(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, encrypted]).toString("base64");

  return `${ENCRYPTION_PREFIX}${payload}`;
}

export function decryptCredentials(ciphertext: string): string {
  if (!ciphertext.startsWith(ENCRYPTION_PREFIX)) {
    throw new Error("Unsupported credential encryption format");
  }

  const key = getEncryptionKey();
  const payload = Buffer.from(
    ciphertext.slice(ENCRYPTION_PREFIX.length),
    "base64",
  );
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

export function isEncryptedCredentials(value: string): boolean {
  return value.startsWith(ENCRYPTION_PREFIX);
}
