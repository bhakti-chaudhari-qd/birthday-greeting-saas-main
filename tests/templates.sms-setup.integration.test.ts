import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import {
  getTemplateSmsSetup,
  updateTemplateSmsSetup,
} from "@/lib/templates/sms-setup";
import { createTemplate, getTemplate } from "@/lib/templates/service";
import { serializeTemplate } from "@/lib/templates/serialize";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;


function registerInput(suffix: string) {
  return {
    organizationName: `SMS Setup Org ${suffix}`,
    organizationSlug: `sms-setup-org-${suffix}`,
    timezone: "UTC",
    adminName: "SMS Setup Admin",
    email: `sms-setup-${suffix}@test.local`,
    password: "password12345",
  };
}

function validSmsTemplateInput(occasionId: string) {
  return {
    name: "Birthday SMS",
    occasionId,
    channel: "SMS" as const,
    body: "Happy Birthday {{name}}!",
    isActive: true,
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("advanced SMS template setup", () => {
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

  it("returns advanced setup for tenant-owned SMS templates", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      validSmsTemplateInput(birthday.id),
    );

    const setup = await getTemplateSmsSetup(org.organization.id, template.id);

    expect(setup.id).toBe(template.id);
    expect(setup.dltTemplateId).toBeNull();
    expect(setup.realSmsReady).toBe(false);

    await cleanupOrganization(org.organization.id);
  });

  it("rejects cross-tenant setup reads", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(
      registerInput(`a-${uniqueSuffix()}`),
    );
    const orgB = await createRegisteredOrganization(
      registerInput(`b-${uniqueSuffix()}`),
    );
    const birthdayA = await ensureSystemBirthdayOccasion(orgA.organization.id);
    const template = await createTemplate(
      orgA.organization.id,
      validSmsTemplateInput(birthdayA.id),
    );

    await expect(
      getTemplateSmsSetup(orgB.organization.id, template.id),
    ).rejects.toThrow();

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("rejects non-SMS templates", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(org.organization.id, {
      ...validSmsTemplateInput(birthday.id),
      channel: "WHATSAPP",
      whatsappTemplateName: "sms_setup_reject",
      whatsappLanguage: "en",
    });

    await expect(
      getTemplateSmsSetup(org.organization.id, template.id),
    ).rejects.toThrow(/SMS templates/i);

    await cleanupOrganization(org.organization.id);
  });

  it("configures DLT pair and derives readiness server-side", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      validSmsTemplateInput(birthday.id),
    );

    const setup = await updateTemplateSmsSetup(org.organization.id, template.id, {
      dltTemplateId: "DLT123456",
      dltApprovedContent: "Happy Birthday {{name}}!",
    });

    expect(setup.realSmsReady).toBe(true);
    expect(setup.realSmsStatusLabel).toBe("Ready for Real SMS");
    expect(setup.dltTemplateId).toBe("DLT123456");

    const persisted = await getTemplate(org.organization.id, template.id);
    expect(persisted.dltTemplateId).toBe("DLT123456");
    expect(persisted.dltApprovedContent).toBe("Happy Birthday {{name}}!");

    await cleanupOrganization(org.organization.id);
  });

  it("requires pair acknowledgement when changing an existing pair", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      validSmsTemplateInput(birthday.id),
    );

    await updateTemplateSmsSetup(org.organization.id, template.id, {
      dltTemplateId: "DLT123456",
      dltApprovedContent: "Happy Birthday {{name}}!",
    });

    await expect(
      updateTemplateSmsSetup(org.organization.id, template.id, {
        dltTemplateId: "DLT999999",
        dltApprovedContent: "Happy Birthday {{name}}!",
      }),
    ).rejects.toThrow(/acknowledgement/i);

    const updated = await updateTemplateSmsSetup(org.organization.id, template.id, {
      dltTemplateId: "DLT999999",
      dltApprovedContent: "Happy Birthday {{name}}!",
      confirmDltPairReviewed: true,
    });

    expect(updated.dltTemplateId).toBe("DLT999999");

    await cleanupOrganization(org.organization.id);
  });

  it("requires acknowledgement for content-only pair changes before compatibility validation", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      validSmsTemplateInput(birthday.id),
    );

    await updateTemplateSmsSetup(org.organization.id, template.id, {
      dltTemplateId: "DLT123456",
      dltApprovedContent: "Happy Birthday {{name}}!",
    });

    await expect(
      updateTemplateSmsSetup(org.organization.id, template.id, {
        dltTemplateId: "DLT123456",
        dltApprovedContent: "Happy Birthday {#name#}!",
      }),
    ).rejects.toThrow(/acknowledgement/i);

    const updated = await updateTemplateSmsSetup(org.organization.id, template.id, {
      dltTemplateId: "DLT123456",
      dltApprovedContent: "Happy Birthday {#name#}!",
      confirmDltPairReviewed: true,
    });

    expect(updated.realSmsReady).toBe(true);
    expect(updated.dltApprovedContent).toBe("Happy Birthday {#name#}!");

    await cleanupOrganization(org.organization.id);
  });

  it("does not let acknowledgement bypass compatibility validation", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      validSmsTemplateInput(birthday.id),
    );

    await updateTemplateSmsSetup(org.organization.id, template.id, {
      dltTemplateId: "DLT123456",
      dltApprovedContent: "Happy Birthday {{name}}!",
    });

    await expect(
      updateTemplateSmsSetup(org.organization.id, template.id, {
        dltTemplateId: "DLT123456",
        dltApprovedContent: "Hello {#name#}!",
        confirmDltPairReviewed: true,
      }),
    ).rejects.toThrow(/static text/i);

    const persisted = await getTemplate(org.organization.id, template.id);
    expect(persisted.dltApprovedContent).toBe("Happy Birthday {{name}}!");

    await cleanupOrganization(org.organization.id);
  });

  it("rejects incompatible approved content", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      validSmsTemplateInput(birthday.id),
    );

    await expect(
      updateTemplateSmsSetup(org.organization.id, template.id, {
        dltTemplateId: "DLT123456",
        dltApprovedContent: "Hello {{name}}!",
      }),
    ).rejects.toThrow(/static text/i);

    await cleanupOrganization(org.organization.id);
  });

  it("re-derives readiness when application body changes through normal update", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      validSmsTemplateInput(birthday.id),
    );

    await updateTemplateSmsSetup(org.organization.id, template.id, {
      dltTemplateId: "DLT123456",
      dltApprovedContent: "Happy Birthday {{name}}!",
    });

    const incompatible = await prisma.messageTemplate.update({
      where: { id: template.id },
      data: { body: "Hi {{name}}!" },
    });

    const serialized = serializeTemplate(incompatible);
    expect(serialized.realSmsReady).toBe(false);
    expect(serialized.realSmsStatusLabel).toBe("Needs SMS Setup");

    const persisted = await getTemplate(org.organization.id, template.id);
    expect(persisted.dltTemplateId).toBe("DLT123456");
    expect(persisted.dltApprovedContent).toBe("Happy Birthday {{name}}!");

    await cleanupOrganization(org.organization.id);
  });

  it("restores readiness when a compatible application body is saved again", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      validSmsTemplateInput(birthday.id),
    );

    await updateTemplateSmsSetup(org.organization.id, template.id, {
      dltTemplateId: "DLT123456",
      dltApprovedContent: "Happy Birthday {{name}}!",
    });

    await prisma.messageTemplate.update({
      where: { id: template.id },
      data: { body: "Hi {{name}}!" },
    });

    const restored = await prisma.messageTemplate.update({
      where: { id: template.id },
      data: { body: "Happy Birthday {{name}}!" },
    });

    const serialized = serializeTemplate(restored);
    expect(serialized.realSmsReady).toBe(true);
    expect(serialized.realSmsStatusLabel).toBe("Ready for Real SMS");

    await cleanupOrganization(org.organization.id);
  });
});
