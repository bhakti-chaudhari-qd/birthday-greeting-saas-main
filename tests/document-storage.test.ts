import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("@aws-sdk/client-s3", async () => {
  const actual =
    await vi.importActual<typeof import("@aws-sdk/client-s3")>(
      "@aws-sdk/client-s3",
    );
  return {
    ...actual,
    S3Client: vi.fn().mockImplementation(() => ({ send: sendMock })),
  };
});

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { b2Storage } from "@/lib/storage/b2-storage";
import {
  DocumentStorageNotConfiguredError,
  DocumentStorageOperationError,
} from "@/lib/storage/errors";

const B2_ENV_KEYS = [
  "B2_ENDPOINT",
  "B2_REGION",
  "B2_APPLICATION_KEY_ID",
  "B2_APPLICATION_KEY",
  "B2_BUCKET_NAME",
] as const;

function clearB2Env() {
  for (const key of B2_ENV_KEYS) {
    delete process.env[key];
  }
}

function setB2Env() {
  process.env.B2_ENDPOINT = "https://s3.us-east-005.backblazeb2.com";
  process.env.B2_REGION = "us-east-005";
  process.env.B2_APPLICATION_KEY_ID = "test-key-id";
  process.env.B2_APPLICATION_KEY = "test-app-key";
  process.env.B2_BUCKET_NAME = "test-bucket";
}

beforeEach(() => {
  sendMock.mockReset();
  clearB2Env();
});

describe("b2Storage - not configured", () => {
  it("fails clearly with a typed error instead of crashing when env vars are missing", async () => {
    await expect(
      b2Storage.upload("key.pdf", new Uint8Array([1]), "application/pdf"),
    ).rejects.toBeInstanceOf(DocumentStorageNotConfiguredError);
    await expect(b2Storage.download("key.pdf")).rejects.toBeInstanceOf(
      DocumentStorageNotConfiguredError,
    );
    await expect(b2Storage.delete("key.pdf")).rejects.toBeInstanceOf(
      DocumentStorageNotConfiguredError,
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("fails clearly when only some B2 vars are set", async () => {
    process.env.B2_ENDPOINT = "https://s3.us-east-005.backblazeb2.com";
    process.env.B2_BUCKET_NAME = "test-bucket";
    // B2_REGION / B2_APPLICATION_KEY_ID / B2_APPLICATION_KEY still missing.

    await expect(
      b2Storage.upload("key.pdf", new Uint8Array([1]), "application/pdf"),
    ).rejects.toBeInstanceOf(DocumentStorageNotConfiguredError);
  });
});

describe("b2Storage - configured", () => {
  beforeEach(() => {
    setB2Env();
  });

  it("uploads bytes to the configured bucket under the given key", async () => {
    sendMock.mockResolvedValueOnce({});
    const bytes = new Uint8Array([1, 2, 3]);

    await b2Storage.upload("generated-documents/org1/abc.pdf", bytes, "application/pdf");

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0]![0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: "test-bucket",
      Key: "generated-documents/org1/abc.pdf",
      Body: bytes,
      ContentType: "application/pdf",
    });
  });

  it("downloads an object and converts its body to bytes", async () => {
    const expectedBytes = new Uint8Array([9, 9, 9]);
    sendMock.mockResolvedValueOnce({
      Body: { transformToByteArray: async () => expectedBytes },
    });

    const result = await b2Storage.download("generated-documents/org1/abc.pdf");

    expect(result).toBe(expectedBytes);
    const command = sendMock.mock.calls[0]![0];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: "test-bucket",
      Key: "generated-documents/org1/abc.pdf",
    });
  });

  it("deletes an object at the given key", async () => {
    sendMock.mockResolvedValueOnce({});

    await b2Storage.delete("generated-documents/org1/abc.pdf");

    const command = sendMock.mock.calls[0]![0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: "test-bucket",
      Key: "generated-documents/org1/abc.pdf",
    });
  });

  it("wraps a failed upload as a typed error without leaking the provider error", async () => {
    sendMock.mockRejectedValueOnce(
      new Error("AccessDenied: some provider-specific detail"),
    );

    await expect(
      b2Storage.upload("key.pdf", new Uint8Array([1]), "application/pdf"),
    ).rejects.toBeInstanceOf(DocumentStorageOperationError);
  });

  it("wraps a failed download as a typed error", async () => {
    sendMock.mockRejectedValueOnce(new Error("NoSuchKey"));

    await expect(b2Storage.download("key.pdf")).rejects.toBeInstanceOf(
      DocumentStorageOperationError,
    );
  });

  it("wraps a failed delete as a typed error", async () => {
    sendMock.mockRejectedValueOnce(new Error("boom"));

    await expect(b2Storage.delete("key.pdf")).rejects.toBeInstanceOf(
      DocumentStorageOperationError,
    );
  });
});
