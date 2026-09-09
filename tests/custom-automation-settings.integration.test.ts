import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { createOccasion, ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import {
  CustomAutomationSettingsError,
  getCustomAutomationSettings,
  updateCustomAutomationSettings,
} from "@/lib/automation/custom-settings";
import { createTemplate, deactivateTemplate } from "@/lib/templates/service";
import { updateCustomAutomationSettingsSchema } from "@/lib/validation/custom-automation";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;


function registerInput(suffix: string) {
  return {
    organizationName: `Custom Settings Org ${suffix}`,
    organizationSlug: `custom-settings-org-${suffix}`,
    timezone: "UTC",
    adminName: "Automation Admin",
    email: `custom-settings-${suffix}@test.local`,
    password: "password12345",
  };
}

function customTemplateInput(occasionId: string, name = "Custom SMS") {
  return {
    name,
    occasionId,
    channel: "SMS" as const,
    body: "Hello {{name}}!",
    isActive: true,
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("custom automation settings", () => {
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
    const parsed = updateCustomAutomationSettingsSchema.safeParse({
      customAutoSendEnabled: true,
      customTemplateId: "template-1",
      organizationId: "other-org",
    });

    expect(parsed.success).toBe(false);
  });

  it("enables automation with a tenant-owned custom template and send time", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const custom = await createOccasion(org.organization.id, "Custom");
    const template = await createTemplate(
      org.organization.id,
      customTemplateInput(custom.id),
    );

    const updated = await updateCustomAutomationSettings(org.organization.id, {
      customAutoSendEnabled: true,
      customTemplateId: template.id,
      automationSendHour: 8,
      automationSendMinute: 15,
    });

    expect(updated.customAutoSendEnabled).toBe(true);
    expect(updated.customTemplateId).toBe(template.id);
    expect(updated.automationSendHour).toBe(8);
    expect(updated.automationSendMinute).toBe(15);
    expect(updated.scheduleDescription).toContain("8:15 AM IST");

    const settings = await getCustomAutomationSettings(org.organization.id);
    expect(settings.eligibleTemplates.some((item) => item.id === template.id)).toBe(
      true,
    );

    await cleanupOrganization(org.organization.id);
  });

  it("rejects enabling automation without a selected template", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    await expect(
      updateCustomAutomationSettings(org.organization.id, {
        customAutoSendEnabled: true,
      }),
    ).rejects.toBeInstanceOf(CustomAutomationSettingsError);

    await cleanupOrganization(org.organization.id);
  });

  it("rejects birthday templates for custom automation", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const custom = await createOccasion(org.organization.id, "Custom");
    const birthday = await createTemplate(org.organization.id, {
      name: "Birthday",
      occasionId: (await ensureSystemBirthdayOccasion(org.organization.id)).id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
    });

    await expect(
      updateCustomAutomationSettings(org.organization.id, {
        customTemplateId: birthday.id,
      }),
    ).rejects.toBeInstanceOf(CustomAutomationSettingsError);

    await cleanupOrganization(org.organization.id);
  });

  it("clears customTemplateId when the selected template is deleted", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const custom = await createOccasion(org.organization.id, "Custom");
    const template = await createTemplate(
      org.organization.id,
      customTemplateInput(custom.id),
    );

    await updateCustomAutomationSettings(org.organization.id, {
      customAutoSendEnabled: true,
      customTemplateId: template.id,
    });

    await deactivateTemplate(org.organization.id, template.id);
    await prisma.messageTemplate.delete({ where: { id: template.id } });

    const settings = await getCustomAutomationSettings(org.organization.id);
    expect(settings.customTemplateId).toBeNull();

    await cleanupOrganization(org.organization.id);
  });
});
