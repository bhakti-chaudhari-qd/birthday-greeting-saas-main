import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { UserRole } from "@prisma/client";

import {
  GET as getLayoutRoute,
  POST as saveLayoutRoute,
} from "@/app/api/v1/document-templates/[id]/layout/route";
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

const MINIMAL_PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF",
  "utf8",
);

function registerInput(suffix: string) {
  return {
    organizationName: `Layout Org ${suffix}`,
    organizationSlug: `layout-org-${suffix}`,
    timezone: "UTC",
    adminName: "Layout Admin",
    email: `layout-admin-${suffix}@test.local`,
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

function validLayout() {
  return {
    layoutJson: {
      elements: [
        {
          id: "el-1",
          type: "text",
          x: 0.5,
          y: 0.5,
          width: 0.2,
          text: "Happy Birthday",
          fontSize: 16,
          color: "#000000",
        },
      ],
    },
  };
}

async function createTemplateForOrg() {
  const formData = new FormData();
  formData.set("name", "Layout Template");
  formData.set(
    "file",
    new File([MINIMAL_PDF_BYTES], "layout.pdf", { type: "application/pdf" }),
  );
  const response = await createTemplateRoute(
    new Request("http://localhost/api/v1/document-templates", {
      method: "POST",
      body: formData,
    }),
  );
  const body = await response.json();
  return body.data.id as string;
}

describe("document template layout API routes", () => {
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

    const getResponse = await getLayoutRoute(
      new Request("http://localhost/api/v1/document-templates/abc/layout"),
      { params: Promise.resolve({ id: "abc" }) },
    );
    expect(getResponse.status).toBe(401);

    const postResponse = await saveLayoutRoute(
      new Request("http://localhost/api/v1/document-templates/abc/layout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validLayout()),
      }),
      { params: Promise.resolve({ id: "abc" }) },
    );
    expect(postResponse.status).toBe(401);
  });

  it("returns null layout before anything is saved, then round-trips a save", async ({
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

    const beforeResponse = await getLayoutRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}/layout`,
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(beforeResponse.status).toBe(200);
    const beforeBody = await beforeResponse.json();
    expect(beforeBody.data.layoutJson).toBeNull();

    const saveResponse = await saveLayoutRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}/layout`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(validLayout()),
        },
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(saveResponse.status).toBe(200);
    const saveBody = await saveResponse.json();
    expect(saveBody.data.layoutJson.elements).toHaveLength(1);
    expect(saveBody.data.layoutJson.elements[0].text).toBe("Happy Birthday");

    const afterResponse = await getLayoutRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}/layout`,
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    const afterBody = await afterResponse.json();
    expect(afterBody.data.layoutJson.elements).toHaveLength(1);

    await cleanupOrganization(org.organization.id);
  });

  it("rejects layouts with out-of-range coordinates, bad color, or too many elements", async ({
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

    const outOfRange = await saveLayoutRoute(
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
                  x: 1.5,
                  y: 0.5,
                  width: 0.2,
                  text: "Oops",
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
    expect(outOfRange.status).toBe(400);

    const badColor = await saveLayoutRoute(
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
                  x: 0.5,
                  y: 0.5,
                  width: 0.2,
                  text: "Oops",
                  fontSize: 16,
                  color: "red",
                },
              ],
            },
          }),
        },
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(badColor.status).toBe(400);

    const tooMany = await saveLayoutRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}/layout`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            layoutJson: {
              elements: Array.from({ length: 201 }, (_, index) => ({
                id: `el-${index}`,
                type: "text",
                x: 0.1,
                y: 0.1,
                width: 0.1,
                text: "x",
                fontSize: 16,
                color: "#000000",
              })),
            },
          }),
        },
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(tooMany.status).toBe(400);

    await cleanupOrganization(org.organization.id);
  });

  it("round-trips typography properties (font size, bold, italic, underline, alignment, color) through save/reload", async ({
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

    const typographyLayout = {
      layoutJson: {
        elements: [
          {
            id: "el-1",
            type: "text",
            x: 0.2,
            y: 0.3,
            width: 0.4,
            text: "Happy Birthday",
            fontSize: 24,
            color: "#ff0000",
            fontWeight: "bold",
            fontStyle: "italic",
            textDecoration: "underline",
            textAlign: "center",
          },
        ],
      },
    };

    const saveResponse = await saveLayoutRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}/layout`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(typographyLayout),
        },
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(saveResponse.status).toBe(200);
    const saveBody = await saveResponse.json();
    expect(saveBody.data.layoutJson.elements[0]).toMatchObject({
      fontSize: 24,
      color: "#ff0000",
      fontWeight: "bold",
      fontStyle: "italic",
      textDecoration: "underline",
      textAlign: "center",
    });

    const reloadResponse = await getLayoutRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}/layout`,
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(reloadResponse.status).toBe(200);
    const reloadBody = await reloadResponse.json();
    expect(reloadBody.data.layoutJson.elements[0]).toMatchObject({
      fontSize: 24,
      color: "#ff0000",
      fontWeight: "bold",
      fontStyle: "italic",
      textDecoration: "underline",
      textAlign: "center",
    });

    await cleanupOrganization(org.organization.id);
  });

  it("rejects an invalid typography enum value", async ({ skip }) => {
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

    const response = await saveLayoutRoute(
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
                  x: 0.5,
                  y: 0.5,
                  width: 0.2,
                  text: "Oops",
                  fontSize: 16,
                  color: "#000000",
                  fontWeight: "extra-bold",
                },
              ],
            },
          }),
        },
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(response.status).toBe(400);

    await cleanupOrganization(org.organization.id);
  });

  it("round-trips a manually resized height through save/reload", async ({
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

    const heightLayout = {
      layoutJson: {
        elements: [
          {
            id: "el-1",
            type: "text",
            x: 0.2,
            y: 0.3,
            width: 0.4,
            height: 0.35,
            text: "Happy Birthday",
            fontSize: 16,
            color: "#000000",
          },
        ],
      },
    };

    const saveResponse = await saveLayoutRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}/layout`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(heightLayout),
        },
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(saveResponse.status).toBe(200);
    const saveBody = await saveResponse.json();
    expect(saveBody.data.layoutJson.elements[0].height).toBe(0.35);

    const reloadResponse = await getLayoutRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}/layout`,
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(reloadResponse.status).toBe(200);
    const reloadBody = await reloadResponse.json();
    expect(reloadBody.data.layoutJson.elements[0].height).toBe(0.35);

    await cleanupOrganization(org.organization.id);
  });

  it("keeps an existing element without height auto-height through save/reload (backward compatibility)", async ({
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

    // Exactly what a template saved before Height Resize V1 looks like.
    const preHeightLayout = {
      layoutJson: {
        elements: [
          {
            id: "el-1",
            type: "text",
            x: 0.2,
            y: 0.3,
            width: 0.4,
            text: "Happy Birthday",
            fontSize: 16,
            color: "#000000",
          },
        ],
      },
    };

    const saveResponse = await saveLayoutRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}/layout`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(preHeightLayout),
        },
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(saveResponse.status).toBe(200);
    const saveBody = await saveResponse.json();
    expect(saveBody.data.layoutJson.elements[0].height).toBeUndefined();

    const reloadResponse = await getLayoutRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}/layout`,
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    const reloadBody = await reloadResponse.json();
    expect(reloadBody.data.layoutJson.elements[0].height).toBeUndefined();

    await cleanupOrganization(org.organization.id);
  });

  it("rejects an out-of-range height (negative, zero, and above maximum)", async ({
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

    async function saveWithHeight(height: number) {
      return saveLayoutRoute(
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
                    x: 0.5,
                    y: 0.5,
                    width: 0.2,
                    height,
                    text: "Oops",
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
    }

    expect((await saveWithHeight(-0.1)).status).toBe(400);
    expect((await saveWithHeight(0)).status).toBe(400);
    expect((await saveWithHeight(1.5)).status).toBe(400);

    await cleanupOrganization(org.organization.id);
  });

  it("only allows ADMIN to save; STAFF can still read", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const org = await createRegisteredOrganization(registerInput(suffix));
    const staff = await prisma.user.create({
      data: {
        organizationId: org.organization.id,
        email: `layout-staff-${suffix}@test.local`,
        name: "Layout Staff",
        role: UserRole.STAFF,
        passwordHash: org.user.passwordHash,
      },
    });

    const adminSession = await createSessionRecord(
      org.user.id,
      org.organization.id,
    );
    await mockSessionCookie(adminSession.rawToken);
    const templateId = await createTemplateForOrg();

    const staffSession = await createSessionRecord(
      staff.id,
      org.organization.id,
    );
    await mockSessionCookie(staffSession.rawToken);

    const staffSaveResponse = await saveLayoutRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}/layout`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(validLayout()),
        },
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(staffSaveResponse.status).toBe(403);

    const staffGetResponse = await getLayoutRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}/layout`,
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(staffGetResponse.status).toBe(200);

    await cleanupOrganization(org.organization.id);
  });

  it("prevents cross-organization access to layouts", async ({ skip }) => {
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

    const sessionB = await createSessionRecord(
      orgB.user.id,
      orgB.organization.id,
    );
    await mockSessionCookie(sessionB.rawToken);

    const getResponse = await getLayoutRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}/layout`,
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(getResponse.status).toBe(404);

    const postResponse = await saveLayoutRoute(
      new Request(
        `http://localhost/api/v1/document-templates/${templateId}/layout`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(validLayout()),
        },
      ),
      { params: Promise.resolve({ id: templateId }) },
    );
    expect(postResponse.status).toBe(404);

    await cleanupOrganization(orgA.organization.id);
    await cleanupOrganization(orgB.organization.id);
  });
});
