import { Channel, QueueStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { getGroupedActivity } from "@/lib/activity/grouped";
import { createContact } from "@/lib/contacts/service";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { createTemplate } from "@/lib/templates/service";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registerInput(suffix: string) {
  return {
    organizationName: `Activity Range Org ${suffix}`,
    organizationSlug: `activity-range-org-${suffix}`,
    timezone: "UTC",
    adminName: "Activity Admin",
    email: `activity-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("grouped activity date range", () => {
  beforeAll(async () => {
    if (!databaseUrl) {
      return;
    }

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

  it("groups queue rows across a multi-day range into per-day groups", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization(registerInput(suffix));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const contact = await createContact(org.organization.id, {
      name: "Range Contact",
      mobile: testMobile(),
    });
    const template = await createTemplate(org.organization.id, {
      name: "Birthday SMS",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
    });

    const dayOne = "2026-08-01";
    const dayTwo = "2026-08-02";
    const dayThree = "2026-08-03";

    for (const day of [dayOne, dayTwo, dayThree]) {
      await prisma.sendQueue.create({
        data: {
          organizationId: org.organization.id,
          contactId: contact.id,
          recipientName: contact.name,
          recipientMobile: contact.mobile,
          templateId: template.id,
          channel: Channel.SMS,
          occasionId: birthday.id,
          scheduledDate: new Date(`${day}T00:00:00.000Z`),
          renderedBody: "Happy Birthday Range Contact!",
          status: QueueStatus.SENT,
          idempotencyKey: `range-test:${org.organization.id}:${day}`,
        },
      });
    }

    // Full 3-day range: one group per day, 3 total sends.
    const fullRange = await getGroupedActivity(org.organization.id, {
      startDate: dayOne,
      endDate: dayThree,
    });
    expect(fullRange.summary.total).toBe(3);
    expect(fullRange.groups).toHaveLength(3);
    expect(fullRange.groups.map((group) => group.scheduledDate).sort()).toEqual([
      dayOne,
      dayTwo,
      dayThree,
    ]);

    // Narrowed to the middle day only: one group, one send.
    const singleDay = await getGroupedActivity(org.organization.id, {
      startDate: dayTwo,
      endDate: dayTwo,
    });
    expect(singleDay.summary.total).toBe(1);
    expect(singleDay.groups).toHaveLength(1);
    expect(singleDay.groups[0]!.scheduledDate).toBe(dayTwo);

    // Swapped start/end (user picks From after To): still resolves to the same range.
    const swapped = await getGroupedActivity(org.organization.id, {
      startDate: dayThree,
      endDate: dayOne,
    });
    expect(swapped.summary.total).toBe(3);
    expect(swapped.startDate).toBe(dayThree);
    expect(swapped.endDate).toBe(dayOne);

    // Only the first two days: 2 groups, day three excluded.
    const partialRange = await getGroupedActivity(org.organization.id, {
      startDate: dayOne,
      endDate: dayTwo,
    });
    expect(partialRange.summary.total).toBe(2);
    expect(partialRange.groups.map((group) => group.scheduledDate).sort()).toEqual([
      dayOne,
      dayTwo,
    ]);

    await cleanupOrganization(org.organization.id);
  });

  it("defaults to today when no range is given", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization(registerInput(suffix));

    const result = await getGroupedActivity(org.organization.id, {});
    expect(result.startDate).toBe(result.endDate);
    expect(result.summary.total).toBe(0);
    expect(result.groups).toHaveLength(0);

    await cleanupOrganization(org.organization.id);
  });
});
