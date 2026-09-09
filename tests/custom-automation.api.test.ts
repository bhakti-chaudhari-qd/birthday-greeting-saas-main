import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/v1/internal/cron/custom-automation/route";
import  { createRegisteredOrganization } from "@/lib/auth/register";
import { updateCustomAutomationSettings } from "@/lib/automation/custom-settings";
import { createTemplate } from "@/lib/templates/service";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

const originalSecret = process.env.CRON_SECRET;


function registerInput(suffix: string) {
  return {
    organizationName: `Custom Cron API Org ${suffix}`,
    organizationSlug: `custom-cron-api-org-${suffix}`,
    timezone: "UTC",
    adminName: "Cron Admin",
    email: `custom-cron-api-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("custom automation cron API", () => {
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
    process.env.CRON_SECRET = originalSecret;
    await prisma.$disconnect();
  });

  it("returns 401 when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;

    const response = await POST(
      new Request("http://localhost/api/v1/internal/cron/custom-automation", {
        method: "POST",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error?.message).toBe(
      "Scheduler authentication is not configured",
    );
  });

  it("runs automation with a valid secret", async ({ skip }) => {
    if (!databaseAvailable) skip();

    process.env.CRON_SECRET = "cron-test-secret";

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const template = await createTemplate(org.organization.id, {
      name: "Custom SMS",
      type: "CUSTOM",
      channel: "SMS",
      body: "Hello {{name}}!",
      isActive: true,
    });

    await updateCustomAutomationSettings(org.organization.id, {
      customAutoSendEnabled: true,
      customTemplateId: template.id,
    });

    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await POST(
      new Request("http://localhost/api/v1/internal/cron/custom-automation", {
        method: "POST",
        headers: { authorization: "Bearer cron-test-secret" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data?.organizationsConsidered).toBeGreaterThanOrEqual(1);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockRestore();
    await cleanupOrganization(org.organization.id);
  });
});
