import { OccasionType } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runAnniversaryAutomation } from "@/lib/automation/anniversary";
import {
  ANNIVERSARY_AUTOMATION_TIMEZONE,
} from "@/lib/automation/constants";
import { updateAnniversaryAutomationSettings } from "@/lib/automation/anniversary-settings";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createContact } from "@/lib/contacts/service";
import { buildAnniversaryIdempotencyKey } from "@/lib/queue/idempotency";
import { generateAnniversaryQueue } from "@/lib/queue/generate";
import { getOrganizationLocalIsoDate } from "@/lib/queue/dates";
import { createTemplate } from "@/lib/templates/service";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;



function registerInput(suffix: string) {
  return {
    organizationName: `Anniv Automation Org ${suffix}`,
    organizationSlug: `anniv-automation-org-${suffix}`,
    timezone: "America/New_York",
    adminName: "Automation Admin",
    email: `anniv-automation-${suffix}@test.local`,
    password: "password12345",
  };
}

function anniversaryTemplateInput(name = "Anniversary SMS") {
  return {
    name,
    type: "ANNIVERSARY" as const,
    channel: "SMS" as const,
    body: "Happy Anniversary {{name}}!",
    isActive: true,
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("anniversary automation", () => {
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

  it("uses anniversary idempotency keys without templateId", () => {
    const key = buildAnniversaryIdempotencyKey({
      contactId: "contact-1",
      channel: "SMS",
      occasionType: OccasionType.ANNIVERSARY,
      targetDate: "2026-07-11",
    });

    expect(key).toBe("anniversary:contact-1:SMS:ANNIVERSARY:2026-07-11");
  });

  it("does not create a second anniversary row when the template changes same IST date", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const templateA = await createTemplate(
      org.organization.id,
      anniversaryTemplateInput("A"),
    );
    const templateB = await createTemplate(
      org.organization.id,
      anniversaryTemplateInput("B"),
    );
    await createContact(org.organization.id, {
      name: "Anniversary Person",
      mobile: testMobile(),
      anniversaryDate: "1990-07-11",

      isActive: true,
    });

    const istToday = getOrganizationLocalIsoDate(
      ANNIVERSARY_AUTOMATION_TIMEZONE,
      new Date("2026-07-11T12:00:00.000Z"),
    );

    const first = await generateAnniversaryQueue(org.organization.id, {
      templateId: templateA.id,
      targetDate: istToday,
    });
    const second = await generateAnniversaryQueue(org.organization.id, {
      templateId: templateB.id,
      targetDate: istToday,
    });

    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(second.skippedDuplicate).toBe(1);

    await cleanupOrganization(org.organization.id);
  });

  it("queues anniversary greetings for enabled organizations on the IST date", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const template = await createTemplate(
      org.organization.id,
      anniversaryTemplateInput(),
    );
    await updateAnniversaryAutomationSettings(org.organization.id, {
      anniversaryAutoSendEnabled: true,
      anniversaryTemplateId: template.id,
    });

    const reference = new Date("2026-07-12T12:00:00.000Z");
    const istToday = getOrganizationLocalIsoDate(
      ANNIVERSARY_AUTOMATION_TIMEZONE,
      reference,
    );

    await createContact(org.organization.id, {
      name: "Eligible",
      mobile: testMobile(),
      anniversaryDate: istToday,

      isActive: true,
    });

    const summary = await runAnniversaryAutomation(reference);

    const orgResult = summary.organizations.find(
      (item) => item.organizationId === org.organization.id,
    );

    expect(orgResult?.status).toBe("processed");
    expect(orgResult?.generation?.created).toBeGreaterThanOrEqual(1);

    await cleanupOrganization(org.organization.id);
  });
});
