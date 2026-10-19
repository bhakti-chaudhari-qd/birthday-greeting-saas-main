import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { DELETE as revokeRoute } from "@/app/api/v1/api-keys/[id]/route";
import {
  GET as listKeysRoute,
  POST as createKeyRoute,
} from "@/app/api/v1/api-keys/route";
import { GET as listContactsRoute } from "@/app/api/v1/contacts/route";
import {
  GET as integrationListRoute,
  POST as integrationUpsertRoute,
} from "@/app/api/v1/integrations/contacts/route";
import {
  API_KEY_TOKEN_PREFIX,
  createApiKey,
  hashApiKey,
} from "@/lib/api-keys/service";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createSessionRecord } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile, uniqueSuffix } from "./helpers";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

const INTEGRATION_URL = "http://localhost/api/v1/integrations/contacts";

function registerInput(suffix: string) {
  return {
    organizationName: `API Key Org ${suffix}`,
    organizationSlug: `api-key-org-${suffix}`,
    timezone: "UTC",
    adminName: "API Key Owner",
    email: `api-key-owner-${suffix}@test.local`,
    password: "password12345",
  };
}

async function mockSessionCookie(rawToken: string | null) {
  const { cookies } = await import("next/headers");

  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      rawToken && name === SESSION_COOKIE_NAME ? { value: rawToken } : undefined,
    set: vi.fn(),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

function listRequest(key: string | null, query = "") {
  return new Request(`${INTEGRATION_URL}${query}`, {
    headers: key ? { Authorization: `Bearer ${key}` } : {},
  });
}

function upsertRequest(key: string, contacts: unknown[]) {
  return new Request(INTEGRATION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contacts }),
  });
}

describe("organization API keys", () => {
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

  it("creates a key once, stores only its hash, and lists it without the secret", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const session = await createSessionRecord(org.user.id, org.organization.id);
    await mockSessionCookie(session.rawToken);

    try {
      const created = await createKeyRoute(
        new Request("http://localhost/api/v1/api-keys", {
          method: "POST",
          body: JSON.stringify({ name: "OMS" }),
        }),
      );
      expect(created.status).toBe(201);
      const { data } = await created.json();
      expect(data.key.startsWith(API_KEY_TOKEN_PREFIX)).toBe(true);

      const stored = await prisma.apiKey.findUniqueOrThrow({
        where: { id: data.id },
      });
      expect(stored.keyHash).toBe(hashApiKey(data.key));
      expect(JSON.stringify(stored)).not.toContain(data.key);

      const listed = await listKeysRoute();
      const listBody = await listed.json();
      expect(listBody.data).toHaveLength(1);
      expect(listBody.data[0].key).toBeUndefined();
      expect(listBody.data[0].keyHash).toBeUndefined();
    } finally {
      await prisma.organization.delete({ where: { id: org.organization.id } });
    }
  });

  it("syncs name, dob, mobile and email only, scoped to the key's organization", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const orgB = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    await mockSessionCookie(null);

    try {
      const keyA = await createApiKey(orgA.organization.id, orgA.user.id, "A");
      const keyB = await createApiKey(orgB.organization.id, orgB.user.id, "B");
      const mobile = uniqueIndianMobile();

      const created = await integrationUpsertRoute(
        upsertRequest(keyA.key, [
          {
            name: "Asha",
            mobile,
            email: "asha@example.com",
            dob: "1990-08-15",
          },
        ]),
      );
      expect(created.status).toBe(200);
      const createdBody = await created.json();
      expect(createdBody.meta).toEqual({ created: 1, updated: 0, failed: 0 });
      expect(createdBody.data[0].contact).toEqual({
        id: expect.any(String),
        name: "Asha",
        dob: "1990-08-15",
        mobile,
        email: "asha@example.com",
      });

      // Same mobile updates in place; omitted email/dob keep their values.
      const updated = await integrationUpsertRoute(
        upsertRequest(keyA.key, [{ name: "Asha Patel", mobile }]),
      );
      const updatedBody = await updated.json();
      expect(updatedBody.meta).toEqual({ created: 0, updated: 1, failed: 0 });
      expect(updatedBody.data[0].contact).toMatchObject({
        name: "Asha Patel",
        dob: "1990-08-15",
        email: "asha@example.com",
      });

      const listA = await (
        await integrationListRoute(listRequest(keyA.key, `?mobile=${mobile}`))
      ).json();
      expect(listA.data).toEqual([updatedBody.data[0].contact]);

      const listB = await (await integrationListRoute(listRequest(keyB.key))).json();
      expect(listB.data).toEqual([]);

      const used = await prisma.apiKey.findUniqueOrThrow({
        where: { id: keyA.id },
      });
      expect(used.lastUsedAt).not.toBeNull();
    } finally {
      await prisma.organization.delete({ where: { id: orgA.organization.id } });
      await prisma.organization.delete({ where: { id: orgB.organization.id } });
    }
  });

  it("rejects missing, unknown, and revoked keys, and is refused by dashboard routes", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const session = await createSessionRecord(org.user.id, org.organization.id);

    try {
      const key = await createApiKey(org.organization.id, org.user.id, "Temp");

      // A logged-in dashboard cookie does not open the integration route.
      await mockSessionCookie(session.rawToken);
      expect((await integrationListRoute(listRequest(null))).status).toBe(401);
      expect(
        (await integrationListRoute(listRequest(`${API_KEY_TOKEN_PREFIX}nope`)))
          .status,
      ).toBe(401);

      // A key does not open dashboard routes.
      await mockSessionCookie(null);
      const dashboard = await listContactsRoute(
        new Request("http://localhost/api/v1/contacts", {
          headers: { Authorization: `Bearer ${key.key}` },
        }),
      );
      expect(dashboard.status).toBe(401);

      await mockSessionCookie(session.rawToken);
      const revoked = await revokeRoute(
        new Request(`http://localhost/api/v1/api-keys/${key.id}`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: key.id }) },
      );
      expect(revoked.status).toBe(200);

      expect((await integrationListRoute(listRequest(key.key))).status).toBe(401);
    } finally {
      await prisma.organization.delete({ where: { id: org.organization.id } });
    }
  });

  it("does not let an API key manage API keys", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    await mockSessionCookie(null);

    try {
      const key = await createApiKey(org.organization.id, org.user.id, "Self");

      const response = await createKeyRoute(
        new Request("http://localhost/api/v1/api-keys", {
          method: "POST",
          headers: { Authorization: `Bearer ${key.key}` },
          body: JSON.stringify({ name: "Escalate" }),
        }),
      );
      expect(response.status).toBe(401);
    } finally {
      await prisma.organization.delete({ where: { id: org.organization.id } });
    }
  });
});
