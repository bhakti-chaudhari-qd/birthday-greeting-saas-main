import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import {
  ensureDefaultContactCategories,
  listContactCategories,
} from "@/lib/contacts/categories";
import {
  TemplateDuplicateError,
  TemplateNotFoundError,
  TemplateValidationError,
} from "@/lib/templates/errors";
import {
  createTemplate,
  deactivateTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  serializeTemplate,
  updateTemplate,
} from "@/lib/templates/service";
import { createOccasion, ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { updateTemplateSmsSetup } from "@/lib/templates/sms-setup";
import { createTemplateSchema } from "@/lib/validation/template";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;
const TEST_OCCASION_ID = "cltest00000000000000000001";


function registerInput(suffix: string) {
  return {
    organizationName: `Templates Org ${suffix}`,
    organizationSlug: `templates-org-${suffix}`,
    timezone: "UTC",
    adminName: "Templates Admin",
    email: `templates-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

function validTemplateInput(occasionId: string) {
  return {
    name: "Birthday SMS",
    occasionId,
    channel: "SMS" as const,
    body: "Happy Birthday {{name}}! Wishing you a wonderful year ahead.",
    isActive: true,
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("message templates CRUD", () => {
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

  it("creates a template in the authenticated organization", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization(registerInput(suffix));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      validTemplateInput(birthday.id),
    );

    expect(template.organizationId).toBe(org.organization.id);
    expect(template.variables).toEqual(["name"]);

    await cleanupOrganization(org.organization.id);
  });

  it("allows the same name for different groups on the same channel", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    await ensureDefaultContactCategories(org.organization.id);
    const categories = await listContactCategories(org.organization.id);
    const vip = categories.find((item) => item.name === "VIP");
    expect(vip).toBeTruthy();

    await createTemplate(org.organization.id, {
      ...validTemplateInput(birthday.id),
      name: "Birthday greeting",
      categoryId: null,
    });
    const vipTemplate = await createTemplate(org.organization.id, {
      ...validTemplateInput(birthday.id),
      name: "Birthday greeting",
      categoryId: vip!.id,
    });

    expect(vipTemplate.categoryId).toBe(vip!.id);

    await cleanupOrganization(org.organization.id);
  });

  it("rejects a duplicate name on the same channel", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    await createTemplate(org.organization.id, validTemplateInput(birthday.id));

    await expect(
      createTemplate(org.organization.id, {
        ...validTemplateInput(birthday.id),
        body: "Another Birthday {{name}}!",
      }),
    ).rejects.toBeInstanceOf(TemplateDuplicateError);

    await cleanupOrganization(org.organization.id);
  });

  it("allows the same name on a different channel", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    await createTemplate(org.organization.id, validTemplateInput(birthday.id));
    const whatsapp = await createTemplate(org.organization.id, {
      name: "Birthday SMS",
      occasionId: birthday.id,
      channel: "WHATSAPP",
      body: "Happy Birthday {{name}}!",
      whatsappTemplateName: "birthday_sms",
      whatsappLanguage: "en",
      isActive: true,
    });

    expect(whatsapp.channel).toBe("WHATSAPP");
    await cleanupOrganization(org.organization.id);
  });

  it("replaceExisting updates the existing same-name template", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const first = await createTemplate(org.organization.id, validTemplateInput(birthday.id));
    const replaced = await createTemplate(org.organization.id, {
      ...validTemplateInput(birthday.id),
      body: "Updated Birthday {{name}}!",
      replaceExisting: true,
    });

    expect(replaced.id).toBe(first.id);
    expect(replaced.body).toContain("Updated Birthday");

    const listed = await listTemplates(org.organization.id, {
      page: 1,
      limit: 20,
      isActive: "all",
    });
    expect(
      listed.data.filter((item) => item.name === "Birthday SMS"),
    ).toHaveLength(1);

    await cleanupOrganization(org.organization.id);
  });

  it("rejects client-supplied organizationId in create schema", () => {
    const parsed = createTemplateSchema.safeParse({
      ...validTemplateInput(TEST_OCCASION_ID),
      organizationId: "other-org",
    });

    expect(parsed.success).toBe(false);
  });

  it("prevents organization B from getting organization A template", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(
      registerInput(`a-${uniqueSuffix()}`),
    );
    const orgB = await createRegisteredOrganization(
      registerInput(`b-${uniqueSuffix()}`),
    );
    const birthdayA = await ensureSystemBirthdayOccasion(orgA.organization.id);
    const template = await createTemplate(orgA.organization.id, {
      ...validTemplateInput(birthdayA.id),
      name: "Protected Template",
    });

    await expect(
      getTemplate(orgB.organization.id, template.id),
    ).rejects.toBeInstanceOf(TemplateNotFoundError);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("prevents organization B from updating organization A template", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(
      registerInput(`a-${uniqueSuffix()}`),
    );
    const orgB = await createRegisteredOrganization(
      registerInput(`b-${uniqueSuffix()}`),
    );
    const birthdayA = await ensureSystemBirthdayOccasion(orgA.organization.id);
    const template = await createTemplate(orgA.organization.id, {
      ...validTemplateInput(birthdayA.id),
      name: "Protected Template",
    });

    await expect(
      updateTemplate(orgB.organization.id, template.id, {
        name: "Hacked",
      }),
    ).rejects.toBeInstanceOf(TemplateNotFoundError);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("prevents organization B from deactivating organization A template", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(
      registerInput(`a-${uniqueSuffix()}`),
    );
    const orgB = await createRegisteredOrganization(
      registerInput(`b-${uniqueSuffix()}`),
    );
    const birthdayA = await ensureSystemBirthdayOccasion(orgA.organization.id);
    const template = await createTemplate(orgA.organization.id, {
      ...validTemplateInput(birthdayA.id),
      name: "Protected Template",
    });

    await expect(
      deactivateTemplate(orgB.organization.id, template.id),
    ).rejects.toBeInstanceOf(TemplateNotFoundError);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("deletes a tenant-owned template", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(
      org.organization.id,
      validTemplateInput(birthday.id),
    );

    await deleteTemplate(org.organization.id, template.id);

    await expect(
      getTemplate(org.organization.id, template.id),
    ).rejects.toBeInstanceOf(TemplateNotFoundError);

    await cleanupOrganization(org.organization.id);
  });

  it("prevents organization B from deleting organization A template", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(
      registerInput(`a-delete-${uniqueSuffix()}`),
    );
    const orgB = await createRegisteredOrganization(
      registerInput(`b-delete-${uniqueSuffix()}`),
    );
    const birthdayA = await ensureSystemBirthdayOccasion(orgA.organization.id);
    const template = await createTemplate(
      orgA.organization.id,
      validTemplateInput(birthdayA.id),
    );

    await expect(
      deleteTemplate(orgB.organization.id, template.id),
    ).rejects.toBeInstanceOf(TemplateNotFoundError);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("rejects invalid template input", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

    await expect(
      createTemplate(org.organization.id, {
        ...validTemplateInput(birthday.id),
        body: "Hello {{firstName}}",
      }),
    ).rejects.toBeInstanceOf(TemplateValidationError);

    await cleanupOrganization(org.organization.id);
  });

  it("updates a tenant-owned template", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(org.organization.id, validTemplateInput(birthday.id));

    const updated = await updateTemplate(org.organization.id, template.id, {
      name: "Updated Birthday SMS",
      body: "Hi {{name}}, happy birthday!",
    });

    expect(updated.name).toBe("Updated Birthday SMS");
    expect(updated.body).toBe("Hi {{name}}, happy birthday!");
    expect(updated.variables).toEqual(["name"]);

    await cleanupOrganization(org.organization.id);
  });

  it("soft deactivates a template", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(org.organization.id, validTemplateInput(birthday.id));

    const deactivated = await deactivateTemplate(org.organization.id, template.id);

    expect(deactivated.isActive).toBe(false);

    await cleanupOrganization(org.organization.id);
  });

  it("preserves DLT metadata and re-derives readiness when the normal body changes", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(org.organization.id, {
      ...validTemplateInput(birthday.id),
      body: "Happy Birthday {{name}}!",
    });

    await updateTemplateSmsSetup(org.organization.id, template.id, {
      dltTemplateId: "DLT123456",
      dltApprovedContent: "Happy Birthday {{name}}!",
    });

    const incompatible = await updateTemplate(org.organization.id, template.id, {
      body: "Hi {{name}}!",
    });
    expect(serializeTemplate(incompatible).realSmsReady).toBe(false);

    const restored = await updateTemplate(org.organization.id, template.id, {
      body: "Happy Birthday {{name}}!",
    });
    expect(serializeTemplate(restored).realSmsReady).toBe(true);

    const persisted = await getTemplate(org.organization.id, template.id);
    expect(persisted.dltTemplateId).toBe("DLT123456");
    expect(persisted.dltApprovedContent).toBe("Happy Birthday {{name}}!");

    await cleanupOrganization(org.organization.id);
  });

  it("scopes search results to the tenant", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const orgA = await createRegisteredOrganization(registerInput(`a-${suffix}`));
    const orgB = await createRegisteredOrganization(registerInput(`b-${suffix}`));
    const birthdayA = await ensureSystemBirthdayOccasion(orgA.organization.id);

    await createTemplate(orgA.organization.id, {
      ...validTemplateInput(birthdayA.id),
      name: "FindMeUniqueTemplate",
    });

    const orgBSearch = await listTemplates(orgB.organization.id, {
      page: 1,
      limit: 20,
      search: "FindMeUniqueTemplate",
      isActive: "all",
    });

    expect(orgBSearch.data).toHaveLength(0);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("returns stable pagination ordering", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

    for (let index = 0; index < 3; index += 1) {
      await createTemplate(org.organization.id, {
        ...validTemplateInput(birthday.id),
        name: `Template ${index}`,
      });
    }

    const page1 = await listTemplates(org.organization.id, {
      page: 1,
      limit: 2,
      isActive: "all",
    });
    const page2 = await listTemplates(org.organization.id, {
      page: 2,
      limit: 2,
      isActive: "all",
    });

    expect(page1.data).toHaveLength(2);
    expect(page2.data).toHaveLength(1);
    expect(page1.meta.total).toBe(3);

    await cleanupOrganization(org.organization.id);
  });

  it("filters by occasion", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const anniversary = await createOccasion(org.organization.id, "Anniversary");

    await createTemplate(org.organization.id, {
      ...validTemplateInput(birthday.id),
      name: "Birthday",
    });
    await createTemplate(org.organization.id, {
      ...validTemplateInput(anniversary.id),
      name: "Anniversary",
    });

    const birthdayOnly = await listTemplates(org.organization.id, {
      page: 1,
      limit: 20,
      occasionId: birthday.id,
      isActive: "all",
    });

    expect(birthdayOnly.data).toHaveLength(1);
    expect(birthdayOnly.data[0]?.occasionId).toBe(birthday.id);

    await cleanupOrganization(org.organization.id);
  });

  it("filters by channel", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

    await createTemplate(org.organization.id, {
      ...validTemplateInput(birthday.id),
      name: "SMS Template",
      channel: "SMS",
    });
    await createTemplate(org.organization.id, {
      ...validTemplateInput(birthday.id),
      name: "WhatsApp Template",
      channel: "WHATSAPP",
      whatsappTemplateName: "filter_template",
      whatsappLanguage: "en",
    });

    const smsOnly = await listTemplates(org.organization.id, {
      page: 1,
      limit: 20,
      channel: "SMS",
      isActive: "all",
    });

    expect(smsOnly.data).toHaveLength(1);
    expect(smsOnly.data[0]?.channel).toBe("SMS");

    await cleanupOrganization(org.organization.id);
  });

  it("filters active and inactive templates", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

    await createTemplate(org.organization.id, {
      ...validTemplateInput(birthday.id),
      name: "Active Template",
      isActive: true,
    });
    await createTemplate(org.organization.id, {
      ...validTemplateInput(birthday.id),
      name: "Inactive Template",
      isActive: false,
    });

    const activeOnly = await listTemplates(org.organization.id, {
      page: 1,
      limit: 20,
      isActive: "true",
    });
    const inactiveOnly = await listTemplates(org.organization.id, {
      page: 1,
      limit: 20,
      isActive: "false",
    });

    expect(activeOnly.data).toHaveLength(1);
    expect(inactiveOnly.data).toHaveLength(1);
    expect(activeOnly.data[0]?.name).toBe("Active Template");
    expect(inactiveOnly.data[0]?.name).toBe("Inactive Template");

    await cleanupOrganization(org.organization.id);
  });
});
