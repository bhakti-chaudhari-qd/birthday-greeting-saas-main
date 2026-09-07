import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GET as getStartersRoute } from "@/app/api/v1/templates/starters/route";
import  { POST as createFromStarterRoute } from "@/app/api/v1/templates/starters/[starterId]/route";
import  {
  GET as getSmsSetupRoute,
  PUT as putSmsSetupRoute,
} from "@/app/api/v1/templates/[id]/sms-setup/route";
import  { POST as createTemplateRoute } from "@/app/api/v1/templates/route";
import  {
  DELETE as deleteTemplateRoute,
  PATCH as updateTemplateRoute,
} from "@/app/api/v1/templates/[id]/route";
import  { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createSessionRecord } from "@/lib/auth/session";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { createTemplate } from "@/lib/templates/service";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;


function registerInput(suffix: string) {
  return {
    organizationName: `Template API Org ${suffix}`,
    organizationSlug: `template-api-org-${suffix}`,
    timezone: "UTC",
    adminName: "Template API Admin",
    email: `template-api-${suffix}@test.local`,
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

describe("template library API routes", () => {
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

  it("rejects unauthenticated starter list requests", async () => {
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
      set: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const response = await getStartersRoute();
    expect(response.status).toBe(401);
  });

  it("lists starter drafts for authenticated tenants", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const session = await createSessionRecord(org.user.id, org.organization.id);
    await mockSessionCookie(session.rawToken);

    const response = await getStartersRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);

    await cleanupOrganization(org.organization.id);
  });

  it("rejects creating templates from removed starter IDs", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const session = await createSessionRecord(org.user.id, org.organization.id);
    await mockSessionCookie(session.rawToken);

    const response = await createFromStarterRoute(
      new Request("http://localhost/api/v1/templates/starters/birthday-greeting", {
        method: "POST",
      }),
      { params: Promise.resolve({ starterId: "birthday-greeting" }) },
    );

    expect(response.status).toBe(400);

    await cleanupOrganization(org.organization.id);
  });

  it("rejects unknown starter IDs", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const session = await createSessionRecord(org.user.id, org.organization.id);
    await mockSessionCookie(session.rawToken);

    const response = await createFromStarterRoute(
      new Request("http://localhost/api/v1/templates/starters/unknown", {
        method: "POST",
      }),
      { params: Promise.resolve({ starterId: "unknown" }) },
    );

    expect(response.status).toBe(400);

    await cleanupOrganization(org.organization.id);
  });

  it("rejects DLT fields on normal template create", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const session = await createSessionRecord(org.user.id, org.organization.id);
    await mockSessionCookie(session.rawToken);
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

    const response = await createTemplateRoute(
      new Request("http://localhost/api/v1/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Birthday SMS",
          occasionId: birthday.id,
          channel: "SMS",
          body: "Happy Birthday {{name}}!",
          dltTemplateId: "DLT123456",
        }),
      }),
    );

    expect(response.status).toBe(400);

    await cleanupOrganization(org.organization.id);
  });

  it("deletes tenant-owned templates", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const session = await createSessionRecord(org.user.id, org.organization.id);
    await mockSessionCookie(session.rawToken);
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(org.organization.id, {
      name: "Delete Me",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
    });

    const response = await deleteTemplateRoute(
      new Request(`http://localhost/api/v1/templates/${template.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: template.id }) },
    );

    expect(response.status).toBe(204);
    await expect(
      prisma.messageTemplate.findUnique({ where: { id: template.id } }),
    ).resolves.toBeNull();

    await cleanupOrganization(org.organization.id);
  });

  it("rejects readiness overrides on normal template update", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const session = await createSessionRecord(org.user.id, org.organization.id);
    await mockSessionCookie(session.rawToken);
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const template = await createTemplate(org.organization.id, {
      name: "Birthday SMS",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
    });

    const response = await updateTemplateRoute(
      new Request(`http://localhost/api/v1/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          realSmsReady: true,
        }),
      }),
      { params: Promise.resolve({ id: template.id }) },
    );

    expect(response.status).toBe(400);

    await cleanupOrganization(org.organization.id);
  });

  it("scopes SMS setup reads and writes to the authenticated tenant", async ({
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
      name: "Birthday SMS",
      occasionId: birthdayA.id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
    });

    const sessionB = await createSessionRecord(orgB.user.id, orgB.organization.id);
    await mockSessionCookie(sessionB.rawToken);

    const getResponse = await getSmsSetupRoute(
      new Request(`http://localhost/api/v1/templates/${template.id}/sms-setup`),
      { params: Promise.resolve({ id: template.id }) },
    );
    expect(getResponse.status).toBe(404);

    const putResponse = await putSmsSetupRoute(
      new Request(`http://localhost/api/v1/templates/${template.id}/sms-setup`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dltTemplateId: "DLT123456",
          dltApprovedContent: "Happy Birthday {{name}}!",
        }),
      }),
      { params: Promise.resolve({ id: template.id }) },
    );
    expect(putResponse.status).toBe(404);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });
});
