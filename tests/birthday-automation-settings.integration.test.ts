import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { ensureSystemBirthdayOccasion, createOccasion } from "@/lib/occasions/service";
import {
  BirthdayAutomationSettingsError,
  getBirthdayAutomationSettings,
  updateBirthdayAutomationSettings,
} from "@/lib/automation/settings";
import { createTemplate, deactivateTemplate } from "@/lib/templates/service";
import { updateBirthdayAutomationSettingsSchema } from "@/lib/validation/birthday-automation";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;


function registerInput(suffix: string) {
  return {
    organizationName: `Automation Settings Org ${suffix}`,
    organizationSlug: `automation-settings-org-${suffix}`,
    timezone: "UTC",
    adminName: "Automation Admin",
    email: `automation-settings-${suffix}@test.local`,
    password: "password12345",
  };
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

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("birthday automation settings", () => {
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
    const parsed = updateBirthdayAutomationSettingsSchema.safeParse({
      autoSendEnabled: true,
      birthdayTemplateId: "template-1",
      organizationId: "other-org",
    });

    expect(parsed.success).toBe(false);
  });

  it("reads automation settings with eligible birthday templates", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(birthday.id),
    );

    const settings = await getBirthdayAutomationSettings(org.organization.id);

    expect(settings.autoSendEnabled).toBe(false);
    expect(settings.birthdayTemplateId).toBeNull();
    expect(settings.eligibleTemplates.some((item) => item.id === template.id)).toBe(
      true,
    );

    await cleanupOrganization(org.organization.id);
  });

  it("enables automation with a tenant-owned birthday template", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(birthday.id),
    );

    const updated = await updateBirthdayAutomationSettings(org.organization.id, {
      autoSendEnabled: true,
      birthdayTemplateId: template.id,
    });

    expect(updated.autoSendEnabled).toBe(true);
    expect(updated.birthdayTemplateId).toBe(template.id);

    await cleanupOrganization(org.organization.id);
  });

  it("rejects enabling automation without a selected template", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    await expect(
      updateBirthdayAutomationSettings(org.organization.id, {
        autoSendEnabled: true,
      }),
    ).rejects.toBeInstanceOf(BirthdayAutomationSettingsError);

    await cleanupOrganization(org.organization.id);
  });

  it("allows disabling automation while retaining the selected template", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput(birthday.id),
    );

    await updateBirthdayAutomationSettings(org.organization.id, {
      autoSendEnabled: true,
      birthdayTemplateId: template.id,
    });

    const updated = await updateBirthdayAutomationSettings(org.organization.id, {
      autoSendEnabled: false,
    });

    expect(updated.autoSendEnabled).toBe(false);
    expect(updated.birthdayTemplateId).toBe(template.id);

    await cleanupOrganization(org.organization.id);
  });

  it("allows disabling when a stored WhatsApp template is no longer birthday type", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const whatsappTemplate = await createTemplate(org.organization.id, {
      name: "Birthday WhatsApp",
      occasionId: birthday.id,
      channel: "WHATSAPP",
      body: "Happy Birthday {{name}}!",
      isActive: true,
      whatsappTemplateName: "birthday_wa",
      whatsappLanguage: "en",
    });

    await updateBirthdayAutomationSettings(org.organization.id, {
      whatsappAutoSendEnabled: true,
      whatsappBirthdayTemplateId: whatsappTemplate.id,
    });

    // Simulate the user later changing that template to Custom - the org still
    // points at it, which previously blocked every Automatic greetings save.
    const anniversary = await createOccasion(org.organization.id, "Anniversary");
    await prisma.messageTemplate.update({
      where: { id: whatsappTemplate.id },
      data: { occasionId: anniversary.id },
    });

    const updated = await updateBirthdayAutomationSettings(org.organization.id, {
      whatsappAutoSendEnabled: false,
      whatsappBirthdayTemplateId: null,
    });

    expect(updated.whatsappAutoSendEnabled).toBe(false);
    expect(updated.whatsappBirthdayTemplateId).toBeNull();

    await cleanupOrganization(org.organization.id);
  });

  it("rejects cross-tenant template selection", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(
      registerInput(`a-${uniqueSuffix()}`),
    );
    const orgB = await createRegisteredOrganization(
      registerInput(`b-${uniqueSuffix()}`),
    );
    const template = await createTemplate(
      orgA.organization.id,
      birthdayTemplateInput((await ensureSystemBirthdayOccasion(orgA.organization.id)).id),
    );

    await expect(
      updateBirthdayAutomationSettings(orgB.organization.id, {
        birthdayTemplateId: template.id,
      }),
    ).rejects.toBeInstanceOf(BirthdayAutomationSettingsError);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("rejects non-birthday, non-sms, and inactive templates", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const anniversaryOccasion = await createOccasion(org.organization.id, "Anniversary");
    const anniversary = await createTemplate(org.organization.id, {
      name: "Anniversary",
      occasionId: anniversaryOccasion.id,
      channel: "SMS",
      body: "Happy Anniversary {{name}}!",
      isActive: true,
    });
    const inactive = await createTemplate(org.organization.id, {
      ...birthdayTemplateInput(birthday.id, "Inactive"),
      isActive: false,
    });

    await expect(
      updateBirthdayAutomationSettings(org.organization.id, {
        birthdayTemplateId: anniversary.id,
      }),
    ).rejects.toBeInstanceOf(BirthdayAutomationSettingsError);

    await expect(
      updateBirthdayAutomationSettings(org.organization.id, {
        birthdayTemplateId: inactive.id,
      }),
    ).rejects.toBeInstanceOf(BirthdayAutomationSettingsError);

    await cleanupOrganization(org.organization.id);
  });

  it("clears birthdayTemplateId when the selected template is deleted", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const template = await createTemplate(
      org.organization.id,
      birthdayTemplateInput((await ensureSystemBirthdayOccasion(org.organization.id)).id),
    );

    await updateBirthdayAutomationSettings(org.organization.id, {
      autoSendEnabled: true,
      birthdayTemplateId: template.id,
    });

    await deactivateTemplate(org.organization.id, template.id);
    await prisma.messageTemplate.delete({ where: { id: template.id } });

    const settings = await getBirthdayAutomationSettings(org.organization.id);
    expect(settings.birthdayTemplateId).toBeNull();

    await cleanupOrganization(org.organization.id);
  });
});
