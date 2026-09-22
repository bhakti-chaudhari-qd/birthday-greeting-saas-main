import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { getPlatformOverviewStats } from "@/lib/admin/overview";
import { prisma } from "@/lib/db";
import { uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registerInput(suffix: string) {
  return {
    organizationName: `Overview Org ${suffix}`,
    organizationSlug: `overview-org-${suffix}`,
    timezone: "Asia/Kolkata",
    adminName: "Owner",
    email: `overview-${suffix}@test.local`,
    password: "password12345",
  };
}

describe("platform overview: messages this month", () => {
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

  it("counts a client's current-month usage but ignores a stale prior-month count", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const current = await createRegisteredOrganization(
      registerInput(uniqueSuffix()),
    );
    const stale = await createRegisteredOrganization(
      registerInput(uniqueSuffix()),
    );

    await prisma.subscription.update({
      where: { organizationId: current.organization.id },
      data: { messagesSentThisMonth: 7, billingPeriodStart: new Date() },
    });
    await prisma.subscription.update({
      where: { organizationId: stale.organization.id },
      data: {
        messagesSentThisMonth: 42,
        billingPeriodStart: new Date("2020-01-01T00:00:00.000Z"),
      },
    });

    const before = await getPlatformOverviewStats();

    // Sanity: the raw counters are what we just set (staleness ignores the
    // DB value, it doesn't clear it).
    const rawStale = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: stale.organization.id },
      select: { messagesSentThisMonth: true },
    });
    expect(rawStale.messagesSentThisMonth).toBe(42);

    await prisma.organization.delete({ where: { id: current.organization.id } });
    await prisma.organization.delete({ where: { id: stale.organization.id } });

    const after = await getPlatformOverviewStats();

    // Removing the current-month org's 7 and the stale org's ignored 42
    // should only change the total by 7.
    expect(before.messagesSentThisMonth - after.messagesSentThisMonth).toBe(7);
  });
});
