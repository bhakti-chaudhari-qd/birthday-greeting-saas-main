import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withCronTickLock } from "@/lib/automation/tick-lock";
import { prisma } from "@/lib/db";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

describe("cron tick lock", () => {
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

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("skips a tick that starts while another is running", async ({ skip }) => {
    if (!databaseAvailable) skip();

    let releaseFirst: () => void = () => undefined;
    const firstHolding = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let firstStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });

    const first = withCronTickLock(async () => {
      firstStarted();
      await firstHolding;
      return "first";
    });

    await started;
    const second = await withCronTickLock(async () => "second");
    expect(second).toEqual({ acquired: false });

    releaseFirst();
    expect(await first).toEqual({ acquired: true, value: "first" });

    // Released once the first tick ends.
    expect(await withCronTickLock(async () => "third")).toEqual({
      acquired: true,
      value: "third",
    });
  });

  it("releases the lock and rethrows when the tick fails", async ({ skip }) => {
    if (!databaseAvailable) skip();

    await expect(
      withCronTickLock(async () => {
        throw new Error("tick blew up");
      }),
    ).rejects.toThrow("tick blew up");

    expect(await withCronTickLock(async () => "after")).toEqual({
      acquired: true,
      value: "after",
    });
  });
});
