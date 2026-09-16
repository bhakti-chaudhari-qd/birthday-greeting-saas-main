import { Channel, QueueStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { exportActivityCsv } from "@/lib/activity/export";
import { createContact } from "@/lib/contacts/service";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { createTemplate } from "@/lib/templates/service";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registerInput(suffix: string) {
  return {
    organizationName: `Export Range Org ${suffix}`,
    organizationSlug: `export-range-org-${suffix}`,
    timezone: "UTC",
    adminName: "Export Admin",
    email: `export-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("activity CSV export date range", () => {
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

  it("exports only failed rows scheduled within the given range", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization(registerInput(suffix));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const contact = await createContact(org.organization.id, {
      name: "Export Contact",
      mobile: testMobile(),
    });
    const template = await createTemplate(org.organization.id, {
      name: "Birthday SMS",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
    });

    const inRangeDay = "2026-09-02";
    const outOfRangeDay = "2026-09-10";

    for (const [day, key] of [
      [inRangeDay, "in-range"],
      [outOfRangeDay, "out-of-range"],
    ] as const) {
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
          renderedBody: "Happy Birthday Export Contact!",
          status: QueueStatus.FAILED,
          lastError: "Provider rejected",
          idempotencyKey: `export-range-test:${org.organization.id}:${key}`,
        },
      });
    }

    const result = await exportActivityCsv(org.organization.id, {
      tab: "failed",
      startDate: "2026-09-01",
      endDate: "2026-09-05",
    });

    expect(result.total).toBe(1);
    expect(result.csv).toContain(inRangeDay);
    expect(result.csv).not.toContain(outOfRangeDay);

    await cleanupOrganization(org.organization.id);
  });
});
