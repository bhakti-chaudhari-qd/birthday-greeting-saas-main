import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ChannelProvider } from "@prisma/client";

import { POST as manualSendRoute } from "@/app/api/v1/manual-send/route";
import  { POST as previewRoute } from "@/app/api/v1/manual-send/preview/route";
import  { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createSessionRecord } from "@/lib/auth/session";
import { upsertSmsChannelConfig } from "@/lib/channel-config/service";
import { createContact } from "@/lib/contacts/service";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { createTemplate } from "@/lib/templates/service";
import { manualSendPreviewRequestSchema, manualSendRequestSchema } from "@/lib/validation/manual-send";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, uniqueSuffix } from "./helpers";


vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;



function registerInput(suffix: string) {
  return {
    organizationName: `Manual Send API Org ${suffix}`,
    organizationSlug: `manual-send-api-org-${suffix}`,
    timezone: "UTC",
    adminName: "Manual Send API Admin",
    email: `manual-send-api-${suffix}@test.local`,
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

async function setupApiOrg() {
  const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
  const session = await createSessionRecord(org.user.id, org.organization.id);
  await mockSessionCookie(session.rawToken);
  await upsertSmsChannelConfig(org.organization.id, {
    provider: ChannelProvider.TEST,
    isActive: true,
  });
  const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

  const template = await createTemplate(org.organization.id, {
    name: "Manual API SMS",
    occasionId: birthday.id,
    channel: "SMS",
    body: "Hello {{name}}!",
    isActive: true,
  });
  const contact = await createContact(org.organization.id, {
    name: "API Person",
    mobile: testMobile(),
    isActive: true,
  });

  return { org, template, contact };
}

describe("manual send API routes", () => {
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

  it("requires authentication for preview", async () => {
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
      set: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const response = await previewRoute(
      new Request("http://localhost/api/v1/manual-send/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: "template-1",
          contactIds: ["contact-1"],
        }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("requires authentication for send", async () => {
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
      set: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const response = await manualSendRoute(
      new Request("http://localhost/api/v1/manual-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: "template-1",
          contactIds: ["contact-1"],
        }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("returns safe preview envelope without DLT fields", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const { org, template, contact } = await setupApiOrg();

    const response = await previewRoute(
      new Request("http://localhost/api/v1/manual-send/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          contactIds: [contact.id],
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.providerModeLabel).toBe("Test mode");
    expect(body.data.previews[0]?.renderedPreview).toContain("API Person");
    expect(body.data).not.toHaveProperty("dltTemplateId");
    expect(body.data.template).not.toHaveProperty("dltApprovedContent");

    await cleanupOrganization(org.organization.id);
  });

  it("returns safe send envelope", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const { org, template, contact } = await setupApiOrg();

    const response = await manualSendRoute(
      new Request("http://localhost/api/v1/manual-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          contactIds: [contact.id],
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.creation.created).toBe(1);
    expect(body.data.queued.created).toBe(1);
    expect(body.data).not.toHaveProperty("send");
    expect(body.data).not.toHaveProperty("dltTemplateId");

    await cleanupOrganization(org.organization.id);
  });

  it("rejects malformed preview requests", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const { org } = await setupApiOrg();

    const response = await previewRoute(
      new Request("http://localhost/api/v1/manual-send/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: "",
        }),
      }),
    );

    expect(response.status).toBe(400);

    await cleanupOrganization(org.organization.id);
  });

  it("allows sample preview without recipients", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const { org, template } = await setupApiOrg();

    const response = await previewRoute(
      new Request("http://localhost/api/v1/manual-send/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          contactIds: [],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.recipientCount).toBe(0);
    expect(body.data.previews).toHaveLength(1);
    expect(body.data.previews[0]?.contactName).toBe("Sample");
    expect(body.data.previews[0]?.renderedPreview).toContain("Name");

    await cleanupOrganization(org.organization.id);
  });

  it("rejects empty recipient lists for send", () => {
    const parsed = manualSendRequestSchema.safeParse({
      templateId: "template-1",
      contactIds: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("allows empty recipient lists for preview", () => {
    const parsed = manualSendPreviewRequestSchema.safeParse({
      templateId: "template-1",
      contactIds: [],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects client-controlled organizationId", () => {
    const parsed = manualSendRequestSchema.safeParse({
      templateId: "template-1",
      contactIds: ["contact-1"],
      organizationId: "other-org",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects client-controlled renderedBody", () => {
    const parsed = manualSendRequestSchema.safeParse({
      templateId: "template-1",
      contactIds: ["contact-1"],
      renderedBody: "Injected body",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects client-controlled phone numbers", () => {
    const parsed = manualSendRequestSchema.safeParse({
      templateId: "template-1",
      contactIds: ["contact-1"],
      phoneNumbers: ["9876543210"],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects client-controlled readiness flags", () => {
    const parsed = manualSendRequestSchema.safeParse({
      templateId: "template-1",
      contactIds: ["contact-1"],
      realSmsReady: true,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects client-controlled DLT fields", () => {
    const parsed = manualSendRequestSchema.safeParse({
      templateId: "template-1",
      contactIds: ["contact-1"],
      dltTemplateId: "DLT123",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects more than 50 recipients", () => {
    const parsed = manualSendRequestSchema.safeParse({
      templateId: "template-1",
      contactIds: Array.from({ length: 51 }, (_, index) => `contact-${index}`),
    });

    expect(parsed.success).toBe(false);
  });
});
