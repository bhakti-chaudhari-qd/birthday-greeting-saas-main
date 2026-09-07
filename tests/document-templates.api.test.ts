import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { UserRole } from "@prisma/client";

import {
  GET as getFileRoute,
} from "@/app/api/v1/document-templates/[id]/file/route";
import {
  DELETE as deleteTemplateRoute,
  GET as getTemplateRoute,
  PATCH as updateTemplateRoute,
} from "@/app/api/v1/document-templates/[id]/route";
import {
  GET as listTemplatesRoute,
  POST as createTemplateRoute,
} from "@/app/api/v1/document-templates/route";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createSessionRecord } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { uniqueSuffix } from "./helpers";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

const MINIMAL_PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF",
  "utf8",
);

function registerInput(suffix: string) {
  return {
    organizationName: `Doc Template Org ${suffix}`,
    organizationSlug: `doc-template-org-${suffix}`,
    timezone: "UTC",
    adminName: "Doc Template Admin",
    email: `doc-template-admin-${suffix}@test.local`,
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

function pdfFormData(overrides: {
  name?: string;
  file?: File;
  occasionId?: string;
} = {}) {
  const formData = new FormData();
  formData.set(
    "file",
    overrides.file ??
      new File([MINIMAL_PDF_BYTES], "birthday.pdf", {
        type: "application/pdf",
      }),
  );
  if (overrides.name !== undefined) {
    formData.set("name", overrides.name);
  }
  if (overrides.occasionId !== undefined) {
    formData.set("occasionId", overrides.occasionId);
  }
  return formData;
}

describe("document template management API routes", () => {
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

  it("rejects unauthenticated requests", async () => {
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
      set: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const listResponse = await listTemplatesRoute(
      new Request("http://localhost/api/v1/document-templates"),
    );
    expect(listResponse.status).toBe(401);

    const createResponse = await createTemplateRoute(
      new Request("http://localhost/api/v1/document-templates", {
        method: "POST",
        body: pdfFormData({ name: "Anonymous Upload" }),
      }),
    );
    expect(createResponse.status).toBe(401);
  });

  it("uploads a valid PDF, lists it, previews the file, updates it, then deletes it", async ({
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

    const createResponse = await createTemplateRoute(
      new Request("http://localhost/api/v1/document-templates", {
        method: "POST",
        body: pdfFormData({ name: "Birthday Card" }),
      }),
    );
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    expect(created.data.name).toBe("Birthday Card");
    expect(created.data.contentType).toBe("application/pdf");
    expect(created.data.byteLength).toBe(MINIMAL_PDF_BYTES.length);
    const templateId = created.data.id as string;

    const listResponse = await listTemplatesRoute(
      new Request("http://localhost/api/v1/document-templates"),
    );
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.data.map((item: { id: string }) => item.id)).toContain(
      templateId,
    );

    const getResponse = await getTemplateRoute(
      new Request(`http://localhost/api/v1/document-templates/${templateId}`),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(getResponse.status).toBe(200);

    const fileResponse = await getFileRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}/file`,
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(fileResponse.status).toBe(200);
    expect(fileResponse.headers.get("Content-Type")).toBe("application/pdf");
    const fileBytes = Buffer.from(await fileResponse.arrayBuffer());
    expect(fileBytes.equals(MINIMAL_PDF_BYTES)).toBe(true);

    const updateResponse = await updateTemplateRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Renamed Card" }),
        },
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(updateResponse.status).toBe(200);
    const updated = await updateResponse.json();
    expect(updated.data.name).toBe("Renamed Card");

    const deleteResponse = await deleteTemplateRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}`,
        { method: "DELETE" },
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(deleteResponse.status).toBe(204);

    const afterDelete = await prisma.documentTemplate.findUnique({
      where: { id: templateId },
    });
    expect(afterDelete).toBeNull();

    await cleanupOrganization(org.organization.id);
  });

  it("rejects non-PDF uploads", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(
      registerInput(uniqueSuffix()),
    );
    const session = await createSessionRecord(
      org.user.id,
      org.organization.id,
    );
    await mockSessionCookie(session.rawToken);

    const response = await createTemplateRoute(
      new Request("http://localhost/api/v1/document-templates", {
        method: "POST",
        body: pdfFormData({
          name: "Not A PDF",
          file: new File(["hello world"], "notes.txt", {
            type: "text/plain",
          }),
        }),
      }),
    );
    expect(response.status).toBe(400);

    await cleanupOrganization(org.organization.id);
  });

  it("rejects uploads missing a name", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(
      registerInput(uniqueSuffix()),
    );
    const session = await createSessionRecord(
      org.user.id,
      org.organization.id,
    );
    await mockSessionCookie(session.rawToken);

    const response = await createTemplateRoute(
      new Request("http://localhost/api/v1/document-templates", {
        method: "POST",
        body: pdfFormData(),
      }),
    );
    expect(response.status).toBe(400);

    await cleanupOrganization(org.organization.id);
  });

  it("lets any org member list templates but only ADMIN create or delete them", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization(registerInput(suffix));
    const staff = await prisma.user.create({
      data: {
        organizationId: org.organization.id,
        email: `doc-template-staff-${suffix}@test.local`,
        name: "Doc Template Staff",
        role: UserRole.STAFF,
        passwordHash: org.user.passwordHash,
      },
    });

    const adminSession = await createSessionRecord(
      org.user.id,
      org.organization.id,
    );
    await mockSessionCookie(adminSession.rawToken);
    const createResponse = await createTemplateRoute(
      new Request("http://localhost/api/v1/document-templates", {
        method: "POST",
        body: pdfFormData({ name: "Shared Template" }),
      }),
    );
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    const templateId = created.data.id as string;

    const staffSession = await createSessionRecord(
      staff.id,
      org.organization.id,
    );
    await mockSessionCookie(staffSession.rawToken);

    const staffListResponse = await listTemplatesRoute(
      new Request("http://localhost/api/v1/document-templates"),
    );
    expect(staffListResponse.status).toBe(200);
    const staffListBody = await staffListResponse.json();
    expect(
      staffListBody.data.map((item: { id: string }) => item.id),
    ).toContain(templateId);

    const staffCreateResponse = await createTemplateRoute(
      new Request("http://localhost/api/v1/document-templates", {
        method: "POST",
        body: pdfFormData({ name: "Staff Attempt" }),
      }),
    );
    expect(staffCreateResponse.status).toBe(403);

    const staffDeleteResponse = await deleteTemplateRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}`,
        { method: "DELETE" },
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(staffDeleteResponse.status).toBe(403);

    await cleanupOrganization(org.organization.id);
  });

  it("prevents cross-organization access to templates", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(
      registerInput(`a-${uniqueSuffix()}`),
    );
    const orgB = await createRegisteredOrganization(
      registerInput(`b-${uniqueSuffix()}`),
    );

    const sessionA = await createSessionRecord(
      orgA.user.id,
      orgA.organization.id,
    );
    await mockSessionCookie(sessionA.rawToken);
    const createResponse = await createTemplateRoute(
      new Request("http://localhost/api/v1/document-templates", {
        method: "POST",
        body: pdfFormData({ name: "Org A Template" }),
      }),
    );
    const created = await createResponse.json();
    const templateId = created.data.id as string;

    const sessionB = await createSessionRecord(
      orgB.user.id,
      orgB.organization.id,
    );
    await mockSessionCookie(sessionB.rawToken);

    const getResponse = await getTemplateRoute(
      new Request(`http://localhost/api/v1/document-templates/${templateId}`),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(getResponse.status).toBe(404);

    const fileResponse = await getFileRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}/file`,
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(fileResponse.status).toBe(404);

    const listResponse = await listTemplatesRoute(
      new Request("http://localhost/api/v1/document-templates"),
    );
    const listBody = await listResponse.json();
    expect(
      listBody.data.map((item: { id: string }) => item.id),
    ).not.toContain(templateId);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });
});
