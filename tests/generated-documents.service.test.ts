import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { POST as saveLayoutRoute } from "@/app/api/v1/document-templates/[id]/layout/route";
import { POST as createTemplateRoute } from "@/app/api/v1/document-templates/route";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createSessionRecord } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  GeneratedDocumentExpiredError,
  GeneratedDocumentNotFoundError,
} from "@/lib/generated-documents/errors";
import {
  DEFAULT_RETENTION_DAYS,
  createGeneratedDocument,
  deleteGeneratedDocument,
  getGeneratedDocument,
  getGeneratedDocumentFile,
  listGeneratedDocuments,
} from "@/lib/generated-documents/service";
import { createInMemoryDocumentStorage } from "./fakes/in-memory-document-storage";
import { uniqueSuffix } from "./helpers";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registerInput(suffix: string) {
  return {
    organizationName: `GenDoc Org ${suffix}`,
    organizationSlug: `gendoc-org-${suffix}`,
    timezone: "UTC",
    adminName: "GenDoc Admin",
    email: `gendoc-admin-${suffix}@test.local`,
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

async function setupOrgWithTemplate(suffix: string) {
  const org = await createRegisteredOrganization(registerInput(suffix));
  const session = await createSessionRecord(org.user.id, org.organization.id);
  await mockSessionCookie(session.rawToken);

  const formData = new FormData();
  formData.set("name", "GenDoc Template");
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

  return { org, templateId };
}

describe("generated-documents service", () => {
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

  it("creates a GeneratedDocument with the right org, template, creator, and default 7-day expiry", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const { org, templateId } = await setupOrgWithTemplate(suffix);
    const storage = createInMemoryDocumentStorage();
    const before = Date.now();

    const document = await createGeneratedDocument(
      org.organization.id,
      org.user.id,
      templateId,
      { name: "Ishika" },
      { storage },
    );

    expect(document.organizationId).toBe(org.organization.id);
    expect(document.templateId).toBe(templateId);
    expect(document.createdByUserId).toBe(org.user.id);
    expect(document.fileSize).toBeGreaterThan(0);
    expect(storage.objects.size).toBe(1);

    const expectedExpiry =
      before + DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const actualExpiry = document.expiresAt.getTime();
    expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(5000);

    await cleanupOrganization(org.organization.id);
  });

  it("supports a custom retention period", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const { org, templateId } = await setupOrgWithTemplate(suffix);
    const storage = createInMemoryDocumentStorage();
    const before = Date.now();

    const document = await createGeneratedDocument(
      org.organization.id,
      org.user.id,
      templateId,
      { name: "Ishika" },
      { storage, retentionDays: 30 },
    );

    const expectedExpiry = before + 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(document.expiresAt.getTime() - expectedExpiry)).toBeLessThan(
      5000,
    );

    await cleanupOrganization(org.organization.id);
  });

  it("org-scopes the list of generated documents", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const storage = createInMemoryDocumentStorage();
    const a = await setupOrgWithTemplate(`a-${uniqueSuffix()}`);
    await createGeneratedDocument(
      a.org.organization.id,
      a.org.user.id,
      a.templateId,
      { name: "A" },
      { storage },
    );

    const b = await setupOrgWithTemplate(`b-${uniqueSuffix()}`);
    await createGeneratedDocument(
      b.org.organization.id,
      b.org.user.id,
      b.templateId,
      { name: "B" },
      { storage },
    );

    const listA = await listGeneratedDocuments(a.org.organization.id, {
      page: 1,
      limit: 20,
    });
    expect(listA.data).toHaveLength(1);

    const listB = await listGeneratedDocuments(b.org.organization.id, {
      page: 1,
      limit: 20,
    });
    expect(listB.data).toHaveLength(1);
    expect(listA.data[0]!.id).not.toBe(listB.data[0]!.id);

    await cleanupOrganization(a.org.organization.id);
    await cleanupOrganization(b.org.organization.id);
  });

  it("allows access to a valid document and returns the stored bytes", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const { org, templateId } = await setupOrgWithTemplate(suffix);
    const storage = createInMemoryDocumentStorage();

    const document = await createGeneratedDocument(
      org.organization.id,
      org.user.id,
      templateId,
      { name: "Ishika" },
      { storage },
    );

    const file = await getGeneratedDocumentFile(
      org.organization.id,
      document.id,
      { storage },
    );
    expect(file.bytes.byteLength).toBe(document.fileSize);
    expect(Buffer.from(file.bytes.slice(0, 5)).toString("utf8")).toBe("%PDF-");

    await cleanupOrganization(org.organization.id);
  });

  it("rejects access to an expired document", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const { org, templateId } = await setupOrgWithTemplate(suffix);
    const storage = createInMemoryDocumentStorage();

    const document = await createGeneratedDocument(
      org.organization.id,
      org.user.id,
      templateId,
      { name: "Ishika" },
      { storage },
    );
    // Backdate expiry directly - the service always computes a future
    // expiresAt on create, so this simulates the passage of time.
    await prisma.generatedDocument.update({
      where: { id: document.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(
      getGeneratedDocumentFile(org.organization.id, document.id, { storage }),
    ).rejects.toBeInstanceOf(GeneratedDocumentExpiredError);

    await cleanupOrganization(org.organization.id);
  });

  it("deletion removes the metadata row and the storage object", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const { org, templateId } = await setupOrgWithTemplate(suffix);
    const storage = createInMemoryDocumentStorage();

    const document = await createGeneratedDocument(
      org.organization.id,
      org.user.id,
      templateId,
      { name: "Ishika" },
      { storage },
    );
    expect(storage.objects.size).toBe(1);

    await deleteGeneratedDocument(org.organization.id, document.id, {
      storage,
    });

    expect(storage.objects.size).toBe(0);
    const row = await prisma.generatedDocument.findUnique({
      where: { id: document.id },
    });
    expect(row).toBeNull();

    await cleanupOrganization(org.organization.id);
  });

  it("does not delete the metadata row when the storage object cannot be removed", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const { org, templateId } = await setupOrgWithTemplate(suffix);
    const storage = createInMemoryDocumentStorage();

    const document = await createGeneratedDocument(
      org.organization.id,
      org.user.id,
      templateId,
      { name: "Ishika" },
      { storage },
    );

    const failingStorage = {
      ...storage,
      delete: vi.fn().mockRejectedValue(new Error("storage delete failed")),
    };

    await expect(
      deleteGeneratedDocument(org.organization.id, document.id, {
        storage: failingStorage,
      }),
    ).rejects.toThrow("storage delete failed");

    // The row must still exist - a failed storage delete is never
    // silently reported as a successful deletion.
    const row = await prisma.generatedDocument.findUnique({
      where: { id: document.id },
    });
    expect(row).not.toBeNull();

    await cleanupOrganization(org.organization.id);
  });

  it("prevents cross-organization access to a generated document", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const storage = createInMemoryDocumentStorage();
    const a = await setupOrgWithTemplate(`a-${uniqueSuffix()}`);
    const document = await createGeneratedDocument(
      a.org.organization.id,
      a.org.user.id,
      a.templateId,
      { name: "A" },
      { storage },
    );

    const b = await setupOrgWithTemplate(`b-${uniqueSuffix()}`);

    await expect(
      getGeneratedDocument(b.org.organization.id, document.id),
    ).rejects.toBeInstanceOf(GeneratedDocumentNotFoundError);
    await expect(
      getGeneratedDocumentFile(b.org.organization.id, document.id, {
        storage,
      }),
    ).rejects.toBeInstanceOf(GeneratedDocumentNotFoundError);
    await expect(
      deleteGeneratedDocument(b.org.organization.id, document.id, {
        storage,
      }),
    ).rejects.toBeInstanceOf(GeneratedDocumentNotFoundError);

    // Confirm org A can still access it - org B's failed attempts didn't
    // touch it.
    const stillThere = await getGeneratedDocument(
      a.org.organization.id,
      document.id,
    );
    expect(stillThere.id).toBe(document.id);

    await cleanupOrganization(a.org.organization.id);
    await cleanupOrganization(b.org.organization.id);
  });
});
