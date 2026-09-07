import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import {
  createTemplateFromStarter,
  dedupeUnusedStarterTemplates,
  listStarterTemplatesForOrganization,
} from "@/lib/templates/service";
import {
  getStarterTemplateDraft,
  listStarterTemplateDrafts,
  STARTER_TEMPLATE_CATALOG,
} from "@/lib/templates/starter-catalog";
import { TemplateValidationError } from "@/lib/templates/errors";
import { prisma } from "@/lib/db";
import { uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registerInput(suffix: string) {
  return {
    organizationName: `Starter Org ${suffix}`,
    organizationSlug: `starter-org-${suffix}`,
    timezone: "UTC",
    adminName: "Starter Admin",
    email: `starter-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

describe("starter template catalog", () => {
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

  it("has no predefined starter drafts", () => {
    expect(STARTER_TEMPLATE_CATALOG).toHaveLength(0);
    expect(listStarterTemplateDrafts()).toHaveLength(0);
  });

  it("rejects unknown starter IDs", () => {
    expect(getStarterTemplateDraft("unknown-starter")).toBeNull();
    expect(getStarterTemplateDraft("birthday-greeting")).toBeNull();
  });

  it("lists an empty starter catalog for organizations", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const drafts = await listStarterTemplatesForOrganization(org.organization.id);
    expect(drafts).toEqual([]);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("rejects creating a template from a removed starter ID", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    await expect(
      createTemplateFromStarter(org.organization.id, "birthday-greeting"),
    ).rejects.toBeInstanceOf(TemplateValidationError);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("dedupe is a no-op when the starter catalog is empty", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const result = await dedupeUnusedStarterTemplates(org.organization.id);
    expect(result.deletedCount).toBe(0);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });
});
