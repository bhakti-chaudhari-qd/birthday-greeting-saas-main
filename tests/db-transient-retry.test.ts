import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  isTransientDatabaseError,
  withTransientDbRetry,
} from "@/lib/db/transient-retry";

describe("isTransientDatabaseError", () => {
  it("detects known Prisma connection codes", () => {
    const error = new Prisma.PrismaClientKnownRequestError("unreachable", {
      code: "P1001",
      clientVersion: "test",
    });
    expect(isTransientDatabaseError(error)).toBe(true);
  });

  it("detects initialization errors", () => {
    const error = new Prisma.PrismaClientInitializationError(
      "Can't reach database server",
      "test",
    );
    expect(isTransientDatabaseError(error)).toBe(true);
  });

  it("ignores non-transient errors", () => {
    expect(isTransientDatabaseError(new Error("Invalid registration input"))).toBe(
      false,
    );
    expect(
      isTransientDatabaseError(
        new Prisma.PrismaClientKnownRequestError("Unique constraint", {
          code: "P2002",
          clientVersion: "test",
        }),
      ),
    ).toBe(false);
  });
});

describe("withTransientDbRetry", () => {
  it("retries transient failures then succeeds", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("unreachable", {
          code: "P1001",
          clientVersion: "test",
        }),
      )
      .mockResolvedValueOnce("ok");

    await expect(
      withTransientDbRetry(operation, { retries: 2, delayMs: 1 }),
    ).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry permanent failures", async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(new Error("An account with this email already exists"));

    await expect(
      withTransientDbRetry(operation, { retries: 2, delayMs: 1 }),
    ).rejects.toThrow("email already exists");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
