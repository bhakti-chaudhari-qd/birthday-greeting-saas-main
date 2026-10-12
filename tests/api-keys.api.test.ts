import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { DELETE as revokeRoute } from "@/app/api/v1/api-keys/[id]/route";
import {
  GET as listKeysRoute,
  POST as createKeyRoute,
} from "@/app/api/v1/api-keys/route";
import {
  GET as listContactsRoute,
  POST as createContactRoute,
} from "@/app/api/v1/contacts/route";
import { API_KEY_RATE_MAX_PER_WINDOW } from "@/lib/api/api-auth";
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

function contactsRequest(key: string | null, init?: RequestInit) {
  return new Request("http://localhost/api/v1/contacts", {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
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
          body: JSON.stringify({ name: "CRM" }),
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

  it("authenticates opted-in routes with a key and scopes them to its organization", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const orgB = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    await mockSessionCookie(null);

    try {
      const keyA = await createApiKey(orgA.organization.id, orgA.user.id, "A");
      const keyB = await createApiKey(orgB.organization.id, orgB.user.id, "B");

      const created = await createContactRoute(
        contactsRequest(keyA.key, {
          method: "POST",
          body: JSON.stringify({
            name: "Via API",
            mobile: uniqueIndianMobile(),
            isActive: true,
          }),
        }),
      );
      expect(created.status).toBe(201);

      const listA = await (await listContactsRoute(contactsRequest(keyA.key))).json();
      const listB = await (await listContactsRoute(contactsRequest(keyB.key))).json();
      expect(JSON.stringify(listA)).toContain("Via API");
      expect(JSON.stringify(listB)).not.toContain("Via API");

      const used = await prisma.apiKey.findUniqueOrThrow({
        where: { id: keyA.id },
      });
      expect(used.lastUsedAt).not.toBeNull();
    } finally {
      await prisma.organization.delete({ where: { id: orgA.organization.id } });
      await prisma.organization.delete({ where: { id: orgB.organization.id } });
    }
  });

  it("rejects missing, unknown, and revoked keys", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const session = await createSessionRecord(org.user.id, org.organization.id);

    try {
      const key = await createApiKey(org.organization.id, org.user.id, "Temp");

      await mockSessionCookie(null);
      expect((await listContactsRoute(contactsRequest(null))).status).toBe(401);
      expect(
        (await listContactsRoute(contactsRequest(`${API_KEY_TOKEN_PREFIX}nope`)))
          .status,
      ).toBe(401);

      // A bad key must not fall back to a valid dashboard cookie.
      await mockSessionCookie(session.rawToken);
      expect(
        (await listContactsRoute(contactsRequest(`${API_KEY_TOKEN_PREFIX}nope`)))
          .status,
      ).toBe(401);

      const revoked = await revokeRoute(
        new Request(`http://localhost/api/v1/api-keys/${key.id}`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ id: key.id }) },
      );
      expect(revoked.status).toBe(200);

      await mockSessionCookie(null);
      expect((await listContactsRoute(contactsRequest(key.key))).status).toBe(401);
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

  it("returns 429 once a key exceeds its per-minute limit", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    await mockSessionCookie(null);

    try {
      const key = await createApiKey(org.organization.id, org.user.id, "Busy");

      for (let index = 0; index < API_KEY_RATE_MAX_PER_WINDOW; index += 1) {
        const response = await listContactsRoute(contactsRequest(key.key));
        expect(response.status).toBe(200);
      }

      const limited = await listContactsRoute(contactsRequest(key.key));
      expect(limited.status).toBe(429);
      expect(limited.headers.get("Retry-After")).toBe("60");
    } finally {
      await prisma.organization.delete({ where: { id: org.organization.id } });
    }
  });
});
