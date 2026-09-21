import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPlatformAdminContext: vi.fn(),
}));

vi.mock("@/lib/auth/platform-admin-session", () => ({
  getPlatformAdminContext: mocks.getPlatformAdminContext,
}));

import { POST } from "@/app/api/v1/admin/organizations/route";
import { prisma } from "@/lib/db";
import { uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;
let adminId = "";

function randomMobile(): string {
  return `9${Math.floor(Math.random() * 1e9).toString().padStart(9, "0")}`;
}

function body(suffix: string, overrides: Record<string, unknown> = {}) {
  return {
    organizationName: `Client ${suffix}`,
    adminName: "Client Owner",
    email: `client-${suffix}@test.local`,
    mobile: randomMobile(),
    password: "password12345",
    ...overrides,
  };
}

function post(payload: unknown) {
  return POST(
    new Request("http://localhost/api/v1/admin/organizations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

describe("admin adds a client", () => {
  beforeAll(async () => {
    if (!databaseUrl) return;
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
      const admin = await prisma.platformAdmin.create({
        data: {
          email: `admin-${uniqueSuffix()}@test.local`,
          passwordHash: "x",
          name: "Platform Admin",
        },
      });
      adminId = admin.id;
    } catch {
      databaseAvailable = false;
    }
  });

  beforeEach(() => {
    mocks.getPlatformAdminContext.mockResolvedValue({ adminId });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects a request that is not from a platform admin", async ({ skip }) => {
    if (!databaseAvailable) skip();
    mocks.getPlatformAdminContext.mockResolvedValue(null);
    const response = await post(body(uniqueSuffix()));
    expect(response.status).toBe(401);
  });

  it("creates the client with an Owner account, defaults and an audit record, without starting a session", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();
    const suffix = uniqueSuffix();
    const payload = body(suffix);
    const sessionsBefore = await prisma.session.count();

    const response = await post(payload);
    expect(response.status).toBe(201);
    const result = (await response.json()).data;

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: result.organization.id },
      include: { subscription: true, contactCategories: true, users: true },
    });
    expect(organization.name).toBe(payload.organizationName);
    expect(organization.subscription?.contactLimit).toBe(500);
    expect(organization.contactCategories.length).toBeGreaterThan(0);
    expect(organization.users).toHaveLength(1);
    expect(organization.users[0]).toMatchObject({
      email: payload.email,
      mobile: payload.mobile,
      role: "ADMIN",
    });

    expect(await prisma.session.count()).toBe(sessionsBefore);
    expect(response.headers.get("set-cookie")).toBeNull();

    const audit = await prisma.platformAdminAuditEvent.findFirst({
      where: { organizationId: organization.id, action: "ORGANIZATION_CREATED" },
    });
    expect(audit?.actorAdminId).toBe(adminId);
  });

  it("returns 409 for an email or mobile that already has an account", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();
    const suffix = uniqueSuffix();
    const first = body(suffix);
    expect((await post(first)).status).toBe(201);

    const sameEmail = await post(body(`${suffix}b`, { email: first.email }));
    expect(sameEmail.status).toBe(409);

    const sameMobile = await post(body(`${suffix}c`, { mobile: first.mobile }));
    expect(sameMobile.status).toBe(409);
  });

  it("returns 400 for a weak password or an invalid mobile", async ({ skip }) => {
    if (!databaseAvailable) skip();
    const suffix = uniqueSuffix();
    expect((await post(body(suffix, { password: "short" }))).status).toBe(400);
    expect((await post(body(suffix, { mobile: "12345678901" }))).status).toBe(400);
  });
});
