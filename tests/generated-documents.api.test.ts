import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { UserRole } from "@prisma/client";

import {
  DELETE as deleteRoute,
  GET as getRoute,
} from "@/app/api/v1/generated-documents/[id]/route";
import { GET as fileRoute } from "@/app/api/v1/generated-documents/[id]/file/route";
import {
  GET as listRoute,
  POST as createRoute,
} from "@/app/api/v1/generated-documents/route";
import { POST as saveLayoutRoute } from "@/app/api/v1/document-templates/[id]/layout/route";
import { POST as createTemplateRoute } from "@/app/api/v1/document-templates/route";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createSessionRecord } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { uniqueSuffix } from "./helpers";

const { fakeStorage } = vi.hoisted(() => {
  const objects = new Map<string, Uint8Array>();
  return {
    fakeStorage: {
      objects,
      async upload(key: string, bytes: Uint8Array) {
        objects.set(key, bytes);
      },
      async download(key: string) {
        const bytes = objects.get(key);
        if (!bytes) {
          throw new Error(`Object not found: ${key}`);
        }
        return bytes;
      },
      async delete(key: string) {
        objects.delete(key);
      },
    },
  };
});

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>(
    "@/lib/storage",
  );
  return { ...actual, documentStorage: fakeStorage };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registerInput(suffix: string) {
  return {
    organizationName: `GenDoc API Org ${suffix}`,
    organizationSlug: `gendoc-api-org-${suffix}`,
    timezone: "UTC",
    adminName: "GenDoc API Admin",
    email: `gendoc-api-admin-${suffix}@test.local`,
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

async function createTestPdfFile(): Promise<File> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([612, 792]);
  const bytes = await pdfDoc.save();
  return new File([Buffer.from(bytes)], "template.pdf", {
    type: "application/pdf",
  });
}

async function createTemplateWithLayout() {
  const formData = new FormData();
  formData.set("name", "GenDoc API Template");
  formData.set("file", await createTestPdfFile());
  const createResponse = await createTemplateRoute(
    new Request("http://localhost/api/v1/document-templates", {
      method: "POST",
      body: formData,
    }),
  );
  const created = await createResponse.json();
  const templateId = created.data.id as string;

  await saveLayoutRoute(
    new Request(
      `http://localhost/api/v1/document-templates/${templateId}/layout`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          layoutJson: {
            elements: [
              {
                id: "el-1",
                type: "text",
                x: 0.1,
                y: 0.1,
                width: 0.5,
                text: "Happy Birthday {{name}}!",
                fontSize: 16,
                color: "#000000",
              },
            ],
          },
        }),
      },
    ),
    { params: Promise.resolve({ id: templateId }) },
  );

  return templateId;
}

function generateAndStore(templateId: string, data: Record<string, string>) {
  return createRoute(
    new Request("http://localhost/api/v1/generated-documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ templateId, data }),
    }),
  );
}

describe("generated-documents API routes", () => {
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

  it("rejects unauthenticated requests on every route", async () => {
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
      set: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    expect((await listRoute(new Request("http://localhost/api/v1/generated-documents"))).status).toBe(401);
    expect((await generateAndStore("abc", { name: "X" })).status).toBe(401);
    expect(
      (
        await getRoute(new Request("http://localhost/api/v1/generated-documents/abc"), {
          params: Promise.resolve({ id: "abc" }),
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await deleteRoute(
          new Request("http://localhost/api/v1/generated-documents/abc", {
            method: "DELETE",
          }),
          { params: Promise.resolve({ id: "abc" }) },
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await fileRoute(
          new Request("http://localhost/api/v1/generated-documents/abc/file"),
          { params: Promise.resolve({ id: "abc" }) },
        )
      ).status,
    ).toBe(401);
  });

  it(
    "full flow: generate -> store -> list -> metadata -> view -> download -> delete",
    async ({ skip }) => {
      if (!databaseAvailable) skip();

      const suffix = uniqueSuffix();
      const org = await createRegisteredOrganization(registerInput(suffix));
      const session = await createSessionRecord(
        org.user.id,
        org.organization.id,
      );
      await mockSessionCookie(session.rawToken);

      const templateId = await createTemplateWithLayout();

      const createResponse = await generateAndStore(templateId, {
        name: "Ishika",
      });
      expect(createResponse.status).toBe(201);
      const createBody = await createResponse.json();
      expect(createBody.data.status).toBe("ACTIVE");
      expect(createBody.data.templateId).toBe(templateId);
      const documentId = createBody.data.id as string;

      const listResponse = await listRoute(
        new Request("http://localhost/api/v1/generated-documents"),
      );
      expect(listResponse.status).toBe(200);
      const listBody = await listResponse.json();
      expect(
        listBody.data.map((item: { id: string }) => item.id),
      ).toContain(documentId);
      expect(listBody.meta.canManage).toBe(true);

      const metaResponse = await getRoute(
        new Request(`http://localhost/api/v1/generated-documents/${documentId}`),
        { params: Promise.resolve({ id: documentId }) },
      );
      expect(metaResponse.status).toBe(200);

      const viewResponse = await fileRoute(
        new Request(
          `http://localhost/api/v1/generated-documents/${documentId}/file`,
        ),
        { params: Promise.resolve({ id: documentId }) },
      );
      expect(viewResponse.status).toBe(200);
      expect(viewResponse.headers.get("Content-Type")).toBe("application/pdf");
      expect(viewResponse.headers.get("Content-Disposition")).toContain("inline");
      const viewedBytes = new Uint8Array(await viewResponse.arrayBuffer());
      expect(Buffer.from(viewedBytes.slice(0, 5)).toString("utf8")).toBe("%PDF-");

      const downloadResponse = await fileRoute(
        new Request(
          `http://localhost/api/v1/generated-documents/${documentId}/file?download=1`,
        ),
        { params: Promise.resolve({ id: documentId }) },
      );
      expect(downloadResponse.headers.get("Content-Disposition")).toContain(
        "attachment",
      );

      const deleteResponse = await deleteRoute(
        new Request(
          `http://localhost/api/v1/generated-documents/${documentId}`,
          { method: "DELETE" },
        ),
        { params: Promise.resolve({ id: documentId }) },
      );
      expect(deleteResponse.status).toBe(204);

      const afterDelete = await getRoute(
        new Request(`http://localhost/api/v1/generated-documents/${documentId}`),
        { params: Promise.resolve({ id: documentId }) },
      );
      expect(afterDelete.status).toBe(404);

      await cleanupOrganization(org.organization.id);
    },
  );

  it("returns 404 for generating from a nonexistent template", async ({
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

    const response = await generateAndStore("does-not-exist", { name: "X" });
    expect(response.status).toBe(404);

    await cleanupOrganization(org.organization.id);
  });

  it("returns 410 for an expired document and hides it from view/download", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization(registerInput(suffix));
    const session = await createSessionRecord(
      org.user.id,
      org.organization.id,
    );
    await mockSessionCookie(session.rawToken);

    const templateId = await createTemplateWithLayout();
    const createResponse = await generateAndStore(templateId, {
      name: "Ishika",
    });
    const documentId = (await createResponse.json()).data.id as string;

    await prisma.generatedDocument.update({
      where: { id: documentId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const metaResponse = await getRoute(
      new Request(`http://localhost/api/v1/generated-documents/${documentId}`),
      { params: Promise.resolve({ id: documentId }) },
    );
    const metaBody = await metaResponse.json();
    expect(metaBody.data.status).toBe("EXPIRED");

    const fileResponse = await fileRoute(
      new Request(
        `http://localhost/api/v1/generated-documents/${documentId}/file`,
      ),
      { params: Promise.resolve({ id: documentId }) },
    );
    expect(fileResponse.status).toBe(410);

    await cleanupOrganization(org.organization.id);
  });

  it("lets STAFF list/view/download but only ADMIN delete", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization(registerInput(suffix));
    const staff = await prisma.user.create({
      data: {
        organizationId: org.organization.id,
        email: `gendoc-staff-${suffix}@test.local`,
        name: "GenDoc Staff",
        role: UserRole.STAFF,
        passwordHash: org.user.passwordHash,
      },
    });

    const adminSession = await createSessionRecord(
      org.user.id,
      org.organization.id,
    );
    await mockSessionCookie(adminSession.rawToken);
    const templateId = await createTemplateWithLayout();
    const createResponse = await generateAndStore(templateId, {
      name: "Ishika",
    });
    const documentId = (await createResponse.json()).data.id as string;

    const staffSession = await createSessionRecord(
      staff.id,
      org.organization.id,
    );
    await mockSessionCookie(staffSession.rawToken);

    const staffListResponse = await listRoute(
      new Request("http://localhost/api/v1/generated-documents"),
    );
    expect(staffListResponse.status).toBe(200);
    const staffListBody = await staffListResponse.json();
    expect(staffListBody.meta.canManage).toBe(false);

    const staffViewResponse = await fileRoute(
      new Request(
        `http://localhost/api/v1/generated-documents/${documentId}/file`,
      ),
      { params: Promise.resolve({ id: documentId }) },
    );
    expect(staffViewResponse.status).toBe(200);

    const staffDeleteResponse = await deleteRoute(
      new Request(
        `http://localhost/api/v1/generated-documents/${documentId}`,
        { method: "DELETE" },
      ),
      { params: Promise.resolve({ id: documentId }) },
    );
    expect(staffDeleteResponse.status).toBe(403);

    await cleanupOrganization(org.organization.id);
  });

  it("prevents cross-organization access, download, and deletion", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(
      registerInput(`a-${uniqueSuffix()}`),
    );
    const sessionA = await createSessionRecord(
      orgA.user.id,
      orgA.organization.id,
    );
    await mockSessionCookie(sessionA.rawToken);
    const templateId = await createTemplateWithLayout();
    const createResponse = await generateAndStore(templateId, {
      name: "Ishika",
    });
    const documentId = (await createResponse.json()).data.id as string;

    const orgB = await createRegisteredOrganization(
      registerInput(`b-${uniqueSuffix()}`),
    );
    const sessionB = await createSessionRecord(
      orgB.user.id,
      orgB.organization.id,
    );
    await mockSessionCookie(sessionB.rawToken);

    const metaResponse = await getRoute(
      new Request(`http://localhost/api/v1/generated-documents/${documentId}`),
      { params: Promise.resolve({ id: documentId }) },
    );
    expect(metaResponse.status).toBe(404);

    const fileResponse = await fileRoute(
      new Request(
        `http://localhost/api/v1/generated-documents/${documentId}/file`,
      ),
      { params: Promise.resolve({ id: documentId }) },
    );
    expect(fileResponse.status).toBe(404);

    const deleteResponse = await deleteRoute(
      new Request(
        `http://localhost/api/v1/generated-documents/${documentId}`,
        { method: "DELETE" },
      ),
      { params: Promise.resolve({ id: documentId }) },
    );
    expect(deleteResponse.status).toBe(404);

    const listResponse = await listRoute(
      new Request("http://localhost/api/v1/generated-documents"),
    );
    const listBody = await listResponse.json();
    expect(
      listBody.data.map((item: { id: string }) => item.id),
    ).not.toContain(documentId);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });
});
