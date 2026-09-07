import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GET as exportRoute } from "@/app/api/v1/contacts/export/route";
import  { POST as importRoute } from "@/app/api/v1/contacts/import/route";
import  { GET as templateRoute } from "@/app/api/v1/contacts/import/template/route";
import  { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createSessionRecord } from "@/lib/auth/session";
import { createContact } from "@/lib/contacts/service";
import { importContactsFromCsv } from "@/lib/contacts/import";
import { exportContactsCsv } from "@/lib/contacts/export";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;



function registerInput(suffix: string) {
  return {
    organizationName: `CSV Org ${suffix}`,
    organizationSlug: `csv-org-${suffix}`,
    timezone: "UTC",
    adminName: "CSV Admin",
    email: `csv-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

async function mockSessionCookie(rawToken: string) {
  const { cookies } = await import("next/headers");

  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME ? { value: rawToken } : undefined,
    set: vi.fn(),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

describe("contact CSV import/export", () => {
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

  it("imports valid rows and updates existing mobiles", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(
      registerInput(uniqueSuffix()),
    );
    const mobile = testMobile();

    await createContact(org.organization.id, {
      name: "Existing",
      mobile,

      isActive: true,
    });

    const newMobile = testMobile();
    const csv = [
      "name,mobile,dateOfBirth,category,address,isActive",
      `Existing Updated,${mobile},1990-01-01,VIP,,true`,
      `Fresh,${newMobile},1991-02-02,Friend,,true`,
      `Also Fresh Dup,${newMobile},,,,,true`,
    ].join("\n");

    const summary = await importContactsFromCsv(org.organization.id, csv);

    expect(summary.created).toBe(1);
    expect(summary.updated).toBe(1);
    expect(summary.skippedDuplicate).toBe(1);
    expect(summary.invalid).toBe(0);

    const updated = await prisma.contact.findFirst({
      where: { organizationId: org.organization.id, mobile },
    });
    expect(updated?.name).toBe("Existing Updated");

    const count = await prisma.contact.count({
      where: { organizationId: org.organization.id },
    });
    expect(count).toBe(2);

    await cleanupOrganization(org.organization.id);
  });

  it("stops creating when contact limit is reached", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(
      registerInput(uniqueSuffix()),
    );

    await prisma.subscription.update({
      where: { organizationId: org.organization.id },
      data: { contactLimit: 1 },
    });

    const csv = [
      "name,mobile",
      `One,${testMobile()}`,
      `Two,${testMobile()}`,
      `Three,${testMobile()}`,
    ].join("\n");

    const summary = await importContactsFromCsv(org.organization.id, csv);

    expect(summary.created).toBe(1);
    expect(summary.skippedLimit).toBe(2);

    await cleanupOrganization(org.organization.id);
  });

  it("exports only the authenticated organization contacts", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(
      registerInput(`a-${uniqueSuffix()}`),
    );
    const orgB = await createRegisteredOrganization(
      registerInput(`b-${uniqueSuffix()}`),
    );

    await createContact(orgA.organization.id, {
      name: "Only A",
      mobile: testMobile(),

      isActive: true,
    });
    await createContact(orgB.organization.id, {
      name: "Only B",
      mobile: testMobile(),

      isActive: true,
    });

    const exported = await exportContactsCsv(orgA.organization.id, {
      isActive: "all",
    });

    expect(exported.csv).toContain("Only A");
    expect(exported.csv).not.toContain("Only B");
    expect(exported.total).toBe(1);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("requires auth on import/export/template routes", async () => {
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
      set: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const importResponse = await importRoute(
      new Request("http://localhost/api/v1/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: "name,mobile\nA,12345" }),
      }),
    );
    expect(importResponse.status).toBe(401);

    const exportResponse = await exportRoute(
      new Request("http://localhost/api/v1/contacts/export"),
    );
    expect(exportResponse.status).toBe(401);

    const templateResponse = await templateRoute();
    expect(templateResponse.status).toBe(401);
  });

  it("imports and exports through authenticated API routes", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(
      registerInput(uniqueSuffix()),
    );
    const session = await createSessionRecord(
      org.user.id,
      org.organization.id,
    );
    await mockSessionCookie(session.rawToken);

    const mobile = testMobile();
    const importResponse = await importRoute(
      new Request("http://localhost/api/v1/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv: `name,mobile\nAPI Person,${mobile}`,
        }),
      }),
    );
    expect(importResponse.status).toBe(200);
    const importBody = await importResponse.json();
    expect(importBody.data.created).toBe(1);

    const exportResponse = await exportRoute(
      new Request("http://localhost/api/v1/contacts/export?isActive=true"),
    );
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers.get("Content-Type")).toContain("text/csv");
    const csv = await exportResponse.text();
    expect(csv).toContain("API Person");
    expect(csv).not.toContain("tags");

    const templateResponse = await templateRoute();
    expect(templateResponse.status).toBe(200);
    const template = await templateResponse.text();
    expect(template).toContain("name,mobile");
    expect(template).not.toContain("tags");

    await cleanupOrganization(org.organization.id);
  });
});
