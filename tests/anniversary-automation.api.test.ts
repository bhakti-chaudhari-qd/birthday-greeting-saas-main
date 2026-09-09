import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/v1/internal/cron/anniversary-automation/route";
import  { createRegisteredOrganization } from "@/lib/auth/register";
import { updateAnniversaryAutomationSettings } from "@/lib/automation/anniversary-settings";
import { createTemplate } from "@/lib/templates/service";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

const originalSecret = process.env.CRON_SECRET;


function registerInput(suffix: string) {
  return {
    organizationName: `Anniv Cron API Org ${suffix}`,
    organizationSlug: `anniv-cron-api-org-${suffix}`,
    timezone: "UTC",
    adminName: "Cron Admin",
    email: `anniv-cron-api-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("anniversary automation cron API", () => {
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
      new Request(
        "http://localhost/api/v1/internal/cron/anniversary-automation",
        { method: "POST" },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error?.message).toBe(
      "Scheduler authentication is not configured",
    );
  });

  it("returns 401 for missing or invalid authorization", async () => {
    process.env.CRON_SECRET = "cron-test-secret";

    const missing = await POST(
      new Request(
        "http://localhost/api/v1/internal/cron/anniversary-automation",
        { method: "POST" },
      ),
    );
    expect(missing.status).toBe(401);

    const invalid = await POST(
      new Request(
        "http://localhost/api/v1/internal/cron/anniversary-automation",
        {
          method: "POST",
          headers: { authorization: "Bearer wrong" },
        },
      ),
    );
    expect(invalid.status).toBe(401);
  });

  it("runs automation for the current IST date with a valid secret", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    process.env.CRON_SECRET = "cron-test-secret";

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const template = await createTemplate(org.organization.id, {
      name: "Anniversary SMS",
      type: "ANNIVERSARY",
      channel: "SMS",
      body: "Happy Anniversary {{name}}!",
      isActive: true,
    });

    await updateAnniversaryAutomationSettings(org.organization.id, {
      anniversaryAutoSendEnabled: true,
      anniversaryTemplateId: template.id,
    });

    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await POST(
      new Request(
        "http://localhost/api/v1/internal/cron/anniversary-automation",
        {
          method: "POST",
          headers: { authorization: "Bearer cron-test-secret" },
        },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data?.organizationsConsidered).toBeGreaterThanOrEqual(1);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockRestore();
    await cleanupOrganization(org.organization.id);
  });
});
