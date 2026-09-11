import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runCustomAutomation } from "@/lib/automation/custom";
import { AUTOMATION_TIMEZONE } from "@/lib/automation/constants";
import { updateCustomAutomationSettings } from "@/lib/automation/custom-settings";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createContact } from "@/lib/contacts/service";
import { buildOccasionIdempotencyKey } from "@/lib/queue/idempotency";
import { generateCustomQueue } from "@/lib/queue/generate";
import { getOrganizationLocalIsoDate } from "@/lib/queue/dates";
import { createTemplate } from "@/lib/templates/service";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;



function registerInput(suffix: string) {
  return {
    organizationName: `Custom Automation Org ${suffix}`,
    organizationSlug: `custom-automation-org-${suffix}`,
    timezone: "America/New_York",
    adminName: "Automation Admin",
    email: `custom-automation-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("custom automation", () => {
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

  it("uses occasion idempotency keys without templateId", () => {
    const key = buildOccasionIdempotencyKey({
      contactId: "contact-1",
      channel: "SMS",
      occasionId: "occasion-1",
      targetDate: "2026-07-11",
    });

    expect(key).toBe("occasion:contact-1:SMS:occasion-1:2026-07-11");
  });

  it("does not create a second custom row when the template changes same IST date", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const templateA = await createTemplate(org.organization.id, {
      name: "A",
      type: "CUSTOM",
      channel: "SMS",
      body: "Hello {{name}}!",
      isActive: true,
    });
    const templateB = await createTemplate(org.organization.id, {
      name: "B",
      type: "CUSTOM",
      channel: "SMS",
      body: "Hi {{name}}!",
      isActive: true,
    });
    await createContact(org.organization.id, {
      name: "Custom Person",
      mobile: testMobile(),
      customOccasionDate: "1990-07-11",

      isActive: true,
    });

    const istToday = getOrganizationLocalIsoDate(
      AUTOMATION_TIMEZONE,
      new Date("2026-07-11T12:00:00.000Z"),
    );

    const first = await generateCustomQueue(org.organization.id, {
      templateId: templateA.id,
      targetDate: istToday,
    });
    const second = await generateCustomQueue(org.organization.id, {
      templateId: templateB.id,
      targetDate: istToday,
    });

    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(second.skippedDuplicate).toBe(1);

    await cleanupOrganization(org.organization.id);
  });

  it("skips organizations before their configured IST send time", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const template = await createTemplate(org.organization.id, {
      name: "Custom",
      type: "CUSTOM",
      channel: "SMS",
      body: "Hello {{name}}!",
      isActive: true,
    });
    await updateCustomAutomationSettings(org.organization.id, {
      customAutoSendEnabled: true,
      customTemplateId: template.id,
      automationSendHour: 9,
      automationSendMinute: 0,
    });

    const beforeSend = new Date("2026-07-11T02:30:00.000Z"); // 08:00 IST
    const summary = await runCustomAutomation(beforeSend);
    const orgResult = summary.organizations.find(
      (item) => item.organizationId === org.organization.id,
    );

    expect(orgResult?.status).toBe("skipped_before_send_time");

    await cleanupOrganization(org.organization.id);
  });

  it("queues custom greetings after the configured IST send time", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const template = await createTemplate(org.organization.id, {
      name: "Custom",
      type: "CUSTOM",
      channel: "SMS",
      body: "Hello {{name}}!",
      isActive: true,
    });
    await updateCustomAutomationSettings(org.organization.id, {
      customAutoSendEnabled: true,
      customTemplateId: template.id,
      automationSendHour: 6,
      automationSendMinute: 0,
    });

    const reference = new Date("2026-07-12T12:00:00.000Z");
    const istToday = getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE, reference);

    await createContact(org.organization.id, {
      name: "Eligible",
      mobile: testMobile(),
      customOccasionDate: istToday,

      isActive: true,
    });

    const summary = await runCustomAutomation(reference);
    const orgResult = summary.organizations.find(
      (item) => item.organizationId === org.organization.id,
    );

    expect(orgResult?.status).toBe("processed");
    expect(orgResult?.generation?.created).toBeGreaterThanOrEqual(1);

    await cleanupOrganization(org.organization.id);
  });
});
