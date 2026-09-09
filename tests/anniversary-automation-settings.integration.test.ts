import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import {
  createOccasion,
  ensureSystemBirthdayOccasion,
} from "@/lib/occasions/service";
import {
  AnniversaryAutomationSettingsError,
  getAnniversaryAutomationSettings,
  updateAnniversaryAutomationSettings,
} from "@/lib/automation/anniversary-settings";
import { createTemplate, deactivateTemplate } from "@/lib/templates/service";
import { updateAnniversaryAutomationSettingsSchema } from "@/lib/validation/anniversary-automation";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;


function registerInput(suffix: string) {
  return {
    organizationName: `Anniv Settings Org ${suffix}`,
    organizationSlug: `anniv-settings-org-${suffix}`,
    timezone: "UTC",
    adminName: "Automation Admin",
    email: `anniv-settings-${suffix}@test.local`,
    password: "password12345",
  };
}

function anniversaryTemplateInput(occasionId: string, name = "Anniversary SMS") {
  return {
    name,
    occasionId,
    channel: "SMS" as const,
    body: "Happy Anniversary {{name}}!",
    isActive: true,
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("anniversary automation settings", () => {
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

  it("rejects client-supplied organizationId in settings schema", () => {
    const parsed = updateAnniversaryAutomationSettingsSchema.safeParse({
      anniversaryAutoSendEnabled: true,
      anniversaryTemplateId: "template-1",
      organizationId: "other-org",
    });

    expect(parsed.success).toBe(false);
  });

  it("reads automation settings with eligible anniversary templates", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const anniversary = await createOccasion(org.organization.id, "Anniversary");
    const template = await createTemplate(
      org.organization.id,
      anniversaryTemplateInput(anniversary.id),
    );

    const settings = await getAnniversaryAutomationSettings(org.organization.id);

    expect(settings.anniversaryAutoSendEnabled).toBe(false);
    expect(settings.anniversaryTemplateId).toBeNull();
    expect(
      settings.eligibleTemplates.some((item) => item.id === template.id),
    ).toBe(true);

    await cleanupOrganization(org.organization.id);
  });

  it("enables automation with a tenant-owned anniversary template", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const anniversary = await createOccasion(org.organization.id, "Anniversary");
    const template = await createTemplate(
      org.organization.id,
      anniversaryTemplateInput(anniversary.id),
    );

    const updated = await updateAnniversaryAutomationSettings(
      org.organization.id,
      {
        anniversaryAutoSendEnabled: true,
        anniversaryTemplateId: template.id,
      },
    );

    expect(updated.anniversaryAutoSendEnabled).toBe(true);
    expect(updated.anniversaryTemplateId).toBe(template.id);

    await cleanupOrganization(org.organization.id);
  });

  it("rejects enabling automation without a selected template", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    await expect(
      updateAnniversaryAutomationSettings(org.organization.id, {
        anniversaryAutoSendEnabled: true,
      }),
    ).rejects.toBeInstanceOf(AnniversaryAutomationSettingsError);

    await cleanupOrganization(org.organization.id);
  });

  it("rejects birthday templates for anniversary automation", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const anniversary = await createOccasion(org.organization.id, "Anniversary");
    const birthdayOccasion = await ensureSystemBirthdayOccasion(org.organization.id);
    const birthday = await createTemplate(org.organization.id, {
      name: "Birthday",
      occasionId: birthdayOccasion.id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
    });

    await expect(
      updateAnniversaryAutomationSettings(org.organization.id, {
        anniversaryTemplateId: birthday.id,
      }),
    ).rejects.toBeInstanceOf(AnniversaryAutomationSettingsError);

    await cleanupOrganization(org.organization.id);
  });

  it("clears anniversaryTemplateId when the selected template is deleted", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const anniversary = await createOccasion(org.organization.id, "Anniversary");
    const template = await createTemplate(
      org.organization.id,
      anniversaryTemplateInput(anniversary.id),
    );

    await updateAnniversaryAutomationSettings(org.organization.id, {
      anniversaryAutoSendEnabled: true,
      anniversaryTemplateId: template.id,
    });

    await deactivateTemplate(org.organization.id, template.id);
    await prisma.messageTemplate.delete({ where: { id: template.id } });

    const settings = await getAnniversaryAutomationSettings(org.organization.id);
    expect(settings.anniversaryTemplateId).toBeNull();

    await cleanupOrganization(org.organization.id);
  });
});
