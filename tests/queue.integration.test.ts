import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { createContact } from "@/lib/contacts/service";
import { createOccasion, ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import {
  QueueTemplateNotFoundError,
  QueueTemplateRejectedError,
} from "@/lib/queue/errors";
import { generateOccasionQueue } from "@/lib/queue/generate";
import { listQueue } from "@/lib/queue/list";
import { createTemplate } from "@/lib/templates/service";
import { generateQueueSchema } from "@/lib/validation/queue";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;



function registerInput(suffix: string) {
  return {
    organizationName: `Queue Org ${suffix}`,
    organizationSlug: `queue-org-${suffix}`,
    timezone: "UTC",
    adminName: "Queue Admin",
    email: `queue-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

function birthdayTemplateInput(occasionId: string, name = "Birthday SMS") {
  return {
    name,
    occasionId,
    channel: "SMS" as const,
    body: "Happy Birthday {{name}}!",
    isActive: true,
  };
}

describe("queue generation", () => {
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

  it("rejects client-supplied organizationId in generate schema", () => {
    const parsed = generateQueueSchema.safeParse({
      templateId: "template-1",
      organizationId: "other-org",
    });

    expect(parsed.success).toBe(false);
  });

  it("generates queue records for eligible birthday contacts", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(birthday.id),
    );
    await createContact(org.organization.id, {
      name: "Birthday Person",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: "1990-07-11" },
      isActive: true,
    });

    const summary = await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });

    expect(summary.created).toBe(1);
    expect(summary.eligible).toBe(1);

    const queue = await listQueue(org.organization.id, {
      page: 1,
      limit: 10,
      scheduledDate: "2026-07-11",
    });

    expect(queue.data).toHaveLength(1);
    expect(queue.data[0]?.renderedBody).toBe("Happy Birthday Birthday Person!");
    expect(queue.data[0]?.status).toBe("PENDING");

    await cleanupOrganization(org.organization.id);
  });

  it("rejects cross-tenant template access", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(
      registerInput(`a-${uniqueSuffix()}`),
    );
    const orgB = await createRegisteredOrganization(
      registerInput(`b-${uniqueSuffix()}`),
    );
    const birthdayA = await ensureSystemBirthdayOccasion(orgA.organization.id);
    const birthdayB = await ensureSystemBirthdayOccasion(orgB.organization.id);
    const template = await createTemplate(
      orgA.organization.id,
      birthdayTemplateInput(birthdayA.id),
    );

    await expect(
      generateOccasionQueue(orgB.organization.id, birthdayB.id, {
        templateId: template.id,
        targetDate: "2026-07-11",
      }),
    ).rejects.toBeInstanceOf(QueueTemplateNotFoundError);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("rejects inactive and non-birthday templates", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const anniversaryOccasion = await createOccasion(org.organization.id, "Anniversary");
    const inactive = await createTemplate(org.organization.id, {
      ...birthdayTemplateInput(birthday.id, "Inactive"),
      isActive: false,
    });
    const anniversary = await createTemplate(org.organization.id, {
      name: "Anniversary",
      occasionId: anniversaryOccasion.id,
      channel: "SMS",
      body: "Happy Anniversary {{name}}!",
      isActive: true,
    });

    await expect(
      generateOccasionQueue(org.organization.id, birthday.id, {
        templateId: inactive.id,
        targetDate: "2026-07-11",
      }),
    ).rejects.toBeInstanceOf(QueueTemplateRejectedError);

    await expect(
      generateOccasionQueue(org.organization.id, birthday.id, {
        templateId: anniversary.id,
        targetDate: "2026-07-11",
      }),
    ).rejects.toBeInstanceOf(QueueTemplateRejectedError);

    await cleanupOrganization(org.organization.id);
  });

  it("excludes inactive and nonmatching contacts", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(birthday.id),
    );

    await createContact(org.organization.id, {
      name: "Inactive",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: "1990-07-11" },
      isActive: false,
    });
    await createContact(org.organization.id, {
      name: "Wrong Day",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: "1990-07-10" },
      isActive: true,
    });

    const summary = await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });

    expect(summary.eligible).toBe(0);
    expect(summary.created).toBe(0);

    await cleanupOrganization(org.organization.id);
  });

  it("preserves leap-day eligibility on Feb 28 in non-leap years", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(birthday.id),
    );
    await createContact(org.organization.id, {
      name: "Leap Baby",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: "2000-02-29" },
      isActive: true,
    });

    const summary = await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2025-02-28",
    });

    expect(summary.eligible).toBe(1);
    expect(summary.created).toBe(1);

    await cleanupOrganization(org.organization.id);
  });

  it("stores rendered snapshots that do not change after edits", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(birthday.id),
    );
    const contact = await createContact(org.organization.id, {
      name: "Snapshot Person",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: "1990-07-11" },
      isActive: true,
    });

    await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });

    await prisma.messageTemplate.update({
      where: { id: template.id },
      data: { body: "Changed {{name}}" },
    });
    await prisma.contact.update({
      where: { id: contact.id },
      data: { name: "Changed Name" },
    });

    const queue = await listQueue(org.organization.id, {
      page: 1,
      limit: 10,
      scheduledDate: "2026-07-11",
    });

    expect(queue.data[0]?.renderedBody).toBe(
      "Happy Birthday Snapshot Person!",
    );

    await cleanupOrganization(org.organization.id);
  });

  it("is idempotent for repeated generation", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(birthday.id),
    );
    await createContact(org.organization.id, {
      name: "Repeat Person",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: "1990-07-11" },
      isActive: true,
    });

    const first = await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });
    const second = await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });

    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(second.skippedDuplicate).toBe(1);

    const queue = await listQueue(org.organization.id, {
      page: 1,
      limit: 10,
      scheduledDate: "2026-07-11",
    });
    expect(queue.data).toHaveLength(1);

    await cleanupOrganization(org.organization.id);
  });

  it("respects monthly send limits without charging duplicates", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(birthday.id),
    );

    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: { monthlyMessageLimit: 1, messagesSentThisMonth: 0 },
    });

    await createContact(org.organization.id, {
      name: "First",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: "1990-07-11" },
      isActive: true,
    });
    await createContact(org.organization.id, {
      name: "Second",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: "1990-07-11" },
      isActive: true,
    });

    const summary = await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });

    expect(summary.created).toBe(1);
    expect(summary.skippedLimit).toBe(1);

    const subscription = await prisma.subscription.findUniqueOrThrow({
      where: { organizationId: org.organization.id },
    });
    expect(subscription.messagesSentThisMonth).toBe(1);

    const duplicateRun = await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });
    expect(duplicateRun.created).toBe(0);
    expect(duplicateRun.skippedDuplicate).toBe(1);
    expect(duplicateRun.skippedLimit).toBe(1);

    const subscriptionAfterDuplicate =
      await prisma.subscription.findUniqueOrThrow({
        where: { organizationId: org.organization.id },
      });
    expect(subscriptionAfterDuplicate.messagesSentThisMonth).toBe(1);

    await cleanupOrganization(org.organization.id);
  });

  it("lists only tenant-owned queue records with filters", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const orgA = await createRegisteredOrganization(registerInput(`a-${suffix}`));
    const orgB = await createRegisteredOrganization(registerInput(`b-${suffix}`));
    const birthdayA = await ensureSystemBirthdayOccasion(orgA.organization.id);
    const template = await createTemplate(
      orgA.organization.id,
      birthdayTemplateInput(birthdayA.id),
    );
    await createContact(orgA.organization.id, {
      name: "Tenant A",
      mobile: testMobile(),
      occasionDates: { [birthdayA.id]: "1990-07-11" },
      isActive: true,
    });

    await generateOccasionQueue(orgA.organization.id, birthdayA.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });

    const orgAList = await listQueue(orgA.organization.id, {
      page: 1,
      limit: 10,
      status: "PENDING",
      channel: "SMS",
      scheduledDate: "2026-07-11",
      search: "Tenant A",
    });
    const orgBList = await listQueue(orgB.organization.id, {
      page: 1,
      limit: 10,
      scheduledDate: "2026-07-11",
    });

    expect(orgAList.data).toHaveLength(1);
    expect(orgBList.data).toHaveLength(0);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("serializes concurrent birthday generation for the same organization", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(birthday.id),
    );
    const contact = await createContact(org.organization.id, {
      name: "Concurrent Person",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: "1990-07-11" },
      isActive: true,
    });

    const [first, second] = await Promise.all([
      generateOccasionQueue(org.organization.id, birthday.id, {
        templateId: template.id,
        targetDate: "2026-07-11",
      }),
      generateOccasionQueue(org.organization.id, birthday.id, {
        templateId: template.id,
        targetDate: "2026-07-11",
      }),
    ]);

    expect(first.created + second.created).toBe(1);
    expect(first.skippedDuplicate + second.skippedDuplicate).toBe(1);

    const rows = await prisma.sendQueue.count({
      where: { organizationId: org.organization.id, contactId: contact.id },
    });
    expect(rows).toBe(1);

    await cleanupOrganization(org.organization.id);
  });
});
