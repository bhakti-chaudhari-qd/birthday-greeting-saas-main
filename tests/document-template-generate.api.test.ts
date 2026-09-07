import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { POST as generateRoute } from "@/app/api/v1/document-templates/[id]/generate/route";
import { POST as saveLayoutRoute } from "@/app/api/v1/document-templates/[id]/layout/route";
import { POST as createTemplateRoute } from "@/app/api/v1/document-templates/route";
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

function registerInput(suffix: string) {
  return {
    organizationName: `Generate Org ${suffix}`,
    organizationSlug: `generate-org-${suffix}`,
    timezone: "UTC",
    adminName: "Generate Admin",
    email: `generate-admin-${suffix}@test.local`,
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

/** A genuinely valid, loadable single-page PDF - not just the "%PDF-" magic bytes. */
async function createTestPdfFile(
  pageSize: [number, number] = [612, 792],
): Promise<File> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage(pageSize);
  const bytes = await pdfDoc.save();
  return new File([Buffer.from(bytes)], "template.pdf", { type: "application/pdf" });
}

async function createTemplateForOrg(name = "Generate Template") {
  const formData = new FormData();
  formData.set("name", name);
  formData.set("file", await createTestPdfFile());
  const response = await createTemplateRoute(
    new Request("http://localhost/api/v1/document-templates", {
      method: "POST",
      body: formData,
    }),
  );
  const body = await response.json();
  return body.data.id as string;
}

async function saveLayoutForTemplate(templateId: string, elements: unknown[]) {
  const response = await saveLayoutRoute(
    new Request(
      `http://localhost/api/v1/document-templates/${templateId}/layout`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ layoutJson: { elements } }),
      },
    ),
    { params: Promise.resolve({ id: templateId }) },
  );
  expect(response.status).toBe(200);
}

function generate(templateId: string, data: Record<string, string>) {
  return generateRoute(
    new Request(
      `http://localhost/api/v1/document-templates/${templateId}/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data }),
      },
    ),
    { params: Promise.resolve({ id: templateId }) },
  );
}

function textElement(overrides: Record<string, unknown> = {}) {
  return {
    id: "el-1",
    type: "text",
    x: 0.1,
    y: 0.1,
    width: 0.5,
    text: "Happy Birthday {{name}}!",
    fontSize: 16,
    color: "#000000",
    ...overrides,
  };
}

describe("document template PDF generation API", () => {
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

    const response = await generate("abc", { name: "Ishika" });
    expect(response.status).toBe(401);
  });

  it("generates a personalized PDF with variable replacement, preserving the original page", async ({
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

    const templateId = await createTemplateForOrg();
    await saveLayoutForTemplate(templateId, [
      textElement({ text: "Happy Birthday {{name}}!" }),
    ]);

    const response = await generate(templateId, { name: "Ishika" });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("attachment");

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Buffer.from(bytes.slice(0, 5)).toString("utf8")).toBe("%PDF-");

    const generatedDoc = await PDFDocument.load(bytes);
    expect(generatedDoc.getPageCount()).toBe(1);
    const page = generatedDoc.getPages()[0]!;
    expect(page.getSize()).toEqual({ width: 612, height: 792 });

    await cleanupOrganization(org.organization.id);
  });

  it("supports multiple variables and the same variable used more than once", async ({
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

    const templateId = await createTemplateForOrg();
    await saveLayoutForTemplate(templateId, [
      textElement({
        id: "el-1",
        text: "Dear {{name}}, we will contact you on {{mobile}}.",
      }),
      textElement({
        id: "el-2",
        y: 0.5,
        text: "Thanks again, {{name}}!",
      }),
    ]);

    const response = await generate(templateId, {
      name: "Ishika",
      mobile: "9876543210",
    });
    expect(response.status).toBe(200);

    await cleanupOrganization(org.organization.id);
  });

  it("fails with a clear message when a required variable is missing", async ({
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

    const templateId = await createTemplateForOrg();
    await saveLayoutForTemplate(templateId, [
      textElement({ text: "Dear {{name}}, call {{mobile}}." }),
    ]);

    const response = await generate(templateId, { mobile: "9876543210" });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toContain("name");
    expect(body.error.message).not.toContain("mobile");

    await cleanupOrganization(org.organization.id);
  });

  it("fails when the template has no saved layout yet", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(
      registerInput(uniqueSuffix()),
    );
    const session = await createSessionRecord(
      org.user.id,
      org.organization.id,
    );
    await mockSessionCookie(session.rawToken);

    const templateId = await createTemplateForOrg();

    const response = await generate(templateId, {});
    expect(response.status).toBe(400);

    await cleanupOrganization(org.organization.id);
  });

  it("returns 404 for a nonexistent template id", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(
      registerInput(uniqueSuffix()),
    );
    const session = await createSessionRecord(
      org.user.id,
      org.organization.id,
    );
    await mockSessionCookie(session.rawToken);

    const response = await generate("does-not-exist", { name: "Ishika" });
    expect(response.status).toBe(404);

    await cleanupOrganization(org.organization.id);
  });

  it("prevents generating from another organization's template", async ({
    skip,
  }) => {
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
    const templateId = await createTemplateForOrg();
    await saveLayoutForTemplate(templateId, [textElement()]);

    const sessionB = await createSessionRecord(
      orgB.user.id,
      orgB.organization.id,
    );
    await mockSessionCookie(sessionB.rawToken);

    const response = await generate(templateId, { name: "Ishika" });
    expect(response.status).toBe(404);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });

  it("wraps long text inside a narrow box without failing", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(
      registerInput(uniqueSuffix()),
    );
    const session = await createSessionRecord(
      org.user.id,
      org.organization.id,
    );
    await mockSessionCookie(session.rawToken);

    const templateId = await createTemplateForOrg();
    await saveLayoutForTemplate(templateId, [
      textElement({
        width: 0.15,
        text: "This is a very long birthday message for {{name}} that will not fit on one line inside a narrow text box.",
      }),
    ]);

    const response = await generate(templateId, { name: "Ishika" });
    expect(response.status).toBe(200);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const generatedDoc = await PDFDocument.load(bytes);
    expect(generatedDoc.getPageCount()).toBe(1);

    await cleanupOrganization(org.organization.id);
  });

  it("handles special characters (emoji) without failing generation", async ({
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

    const templateId = await createTemplateForOrg();
    await saveLayoutForTemplate(templateId, [
      textElement({ text: "Happy Birthday {{name}}! 🎉🎂" }),
    ]);

    const response = await generate(templateId, { name: "Ishika" });
    expect(response.status).toBe(200);

    await cleanupOrganization(org.organization.id);
  });

  it("handles multiple text elements at different positions in one generation", async ({
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

    const templateId = await createTemplateForOrg();
    await saveLayoutForTemplate(templateId, [
      textElement({ id: "el-1", x: 0.1, y: 0.1, text: "Happy Birthday {{name}}!" }),
      textElement({ id: "el-2", x: 0.1, y: 0.4, text: "Call: {{mobile}}" }),
      textElement({ id: "el-3", x: 0.1, y: 0.7, text: "Static text, no variables." }),
    ]);

    const response = await generate(templateId, {
      name: "Ishika",
      mobile: "9876543210",
    });
    expect(response.status).toBe(200);

    await cleanupOrganization(org.organization.id);
  });

  it("generates successfully with every typography combination (bold, italic, bold+italic, underline, alignment, color)", async ({
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

    const templateId = await createTemplateForOrg();
    await saveLayoutForTemplate(templateId, [
      textElement({
        id: "el-bold",
        y: 0.05,
        text: "Bold {{name}}",
        fontWeight: "bold",
      }),
      textElement({
        id: "el-italic",
        y: 0.2,
        text: "Italic {{name}}",
        fontStyle: "italic",
      }),
      textElement({
        id: "el-bold-italic",
        y: 0.35,
        text: "Bold italic {{name}}",
        fontWeight: "bold",
        fontStyle: "italic",
      }),
      textElement({
        id: "el-underline",
        y: 0.5,
        text: "Underlined {{name}}",
        textDecoration: "underline",
      }),
      textElement({
        id: "el-center",
        y: 0.65,
        text: "Centered {{name}}",
        textAlign: "center",
      }),
      textElement({
        id: "el-right",
        y: 0.8,
        text: "Right {{name}}",
        textAlign: "right",
      }),
      textElement({
        id: "el-color",
        y: 0.9,
        text: "Colored {{name}}",
        color: "#ff0000",
      }),
    ]);

    const response = await generate(templateId, { name: "Ishika" });
    expect(response.status).toBe(200);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const generatedDoc = await PDFDocument.load(bytes);
    expect(generatedDoc.getPageCount()).toBe(1);

    await cleanupOrganization(org.organization.id);
  });

  it("still generates a valid PDF for elements with no typography fields at all (backward compatibility)", async ({
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

    const templateId = await createTemplateForOrg();
    // No fontWeight/fontStyle/textDecoration/textAlign - exactly what a
    // template saved before Typography V1 looks like.
    await saveLayoutForTemplate(templateId, [
      textElement({ text: "Happy Birthday {{name}}!" }),
    ]);

    const response = await generate(templateId, { name: "Ishika" });
    expect(response.status).toBe(200);
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Buffer.from(bytes.slice(0, 5)).toString("utf8")).toBe("%PDF-");

    await cleanupOrganization(org.organization.id);
  });

  it("wraps a right-aligned narrow box across multiple lines without failing", async ({
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

    const templateId = await createTemplateForOrg();
    await saveLayoutForTemplate(templateId, [
      textElement({
        width: 0.15,
        textAlign: "right",
        fontWeight: "bold",
        text: "This is a fairly long birthday message for {{name}} in a narrow, right-aligned, bold box.",
      }),
    ]);

    const response = await generate(templateId, { name: "Ishika" });
    expect(response.status).toBe(200);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const generatedDoc = await PDFDocument.load(bytes);
    expect(generatedDoc.getPageCount()).toBe(1);

    await cleanupOrganization(org.organization.id);
  });
});
