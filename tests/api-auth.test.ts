import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as listContactsRoute } from "@/app/api/v1/contacts/route";
import { GET as listKeysRoute } from "@/app/api/v1/api-keys/route";
import {
  GET as integrationListRoute,
  POST as integrationUpsertRoute,
} from "@/app/api/v1/integrations/contacts/route";
import { API_KEY_RATE_MAX_PER_WINDOW, requireApiKey } from "@/lib/api/api-auth";
import { API_KEY_TOKEN_PREFIX, hashApiKey } from "@/lib/api-keys/service";
import { listIntegrationContacts } from "@/lib/integrations/contacts";

const { apiKeyFindUnique, apiKeyUpdate, contactCount, contactFindMany } =
  vi.hoisted(() => ({
    apiKeyFindUnique: vi.fn(),
    apiKeyUpdate: vi.fn(),
    contactCount: vi.fn(),
    contactFindMany: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({
  prisma: {
    apiKey: { findUnique: apiKeyFindUnique, update: apiKeyUpdate },
    contact: { count: contactCount, findMany: contactFindMany },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  },
}));

vi.mock("@/lib/occasions/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/occasions/service")>()),
  ensureSystemBirthdayOccasion: vi.fn(async () => ({ id: "occ_birthday" })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, set: vi.fn() })),
}));

function keyRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: "org_1",
    revokedAt: null,
    lastUsedAt: null,
    organization: { id: "org_1", isActive: true },
    createdBy: { id: "user_1", organizationId: "org_1", isActive: true },
    ...overrides,
  };
}

function withKey(token: string | null, url = "http://localhost/api/v1/integrations/contacts") {
  return new Request(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe("API key auth", () => {
  beforeEach(() => {
    apiKeyFindUnique.mockReset();
    apiKeyUpdate.mockReset();
    apiKeyUpdate.mockResolvedValue({});
    contactCount.mockReset();
    contactCount.mockResolvedValue(0);
    contactFindMany.mockReset();
    contactFindMany.mockResolvedValue([]);
  });

  it("resolves a valid key to its organization only", async () => {
    const rawKey = `${API_KEY_TOKEN_PREFIX}valid`;
    apiKeyFindUnique.mockResolvedValue(keyRow("key_valid"));

    const resolved = await requireApiKey(withKey(rawKey));

    expect(apiKeyFindUnique.mock.calls[0][0].where).toEqual({
      keyHash: hashApiKey(rawKey),
    });
    expect(resolved).toEqual({ apiKeyId: "key_valid", organizationId: "org_1" });
    expect(apiKeyUpdate).toHaveBeenCalledOnce();
  });

  it("rejects missing, foreign, unknown, revoked and disabled keys", async () => {
    await expect(requireApiKey(withKey(null))).rejects.toThrow();
    await expect(requireApiKey(withKey("not-our-token"))).rejects.toThrow();
    expect(apiKeyFindUnique).not.toHaveBeenCalled();

    for (const row of [
      null,
      keyRow("key_revoked", { revokedAt: new Date() }),
      keyRow("key_org_off", { organization: { id: "org_1", isActive: false } }),
      keyRow("key_user_off", {
        createdBy: { id: "user_1", organizationId: "org_1", isActive: false },
      }),
    ]) {
      apiKeyFindUnique.mockResolvedValue(row);
      const response = await integrationListRoute(
        withKey(`${API_KEY_TOKEN_PREFIX}x`),
      );
      expect(response.status).toBe(401);
    }
  });

  it("returns 429 once a key exceeds its per-minute limit", async () => {
    apiKeyFindUnique.mockResolvedValue(keyRow("key_busy"));
    const rawKey = `${API_KEY_TOKEN_PREFIX}busy`;

    for (let index = 0; index < API_KEY_RATE_MAX_PER_WINDOW; index += 1) {
      await requireApiKey(withKey(rawKey));
    }

    const limited = await integrationListRoute(withKey(rawKey));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
  });

  it("is not accepted by dashboard routes or key management", async () => {
    apiKeyFindUnique.mockResolvedValue(keyRow("key_scope"));
    const rawKey = `${API_KEY_TOKEN_PREFIX}scope`;

    const contacts = await listContactsRoute(
      withKey(rawKey, "http://localhost/api/v1/contacts"),
    );
    expect(contacts.status).toBe(401);
    expect((await listKeysRoute()).status).toBe(401);
    expect(apiKeyFindUnique).not.toHaveBeenCalled();
  });

  it("rejects fields other than name, mobile, email and dob on upsert", async () => {
    apiKeyFindUnique.mockResolvedValue(keyRow("key_strict"));

    const response = await integrationUpsertRoute(
      new Request("http://localhost/api/v1/integrations/contacts", {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY_TOKEN_PREFIX}strict` },
        body: JSON.stringify({
          contacts: [{ name: "A", mobile: "9876543210", note: "secret" }],
        }),
      }),
    );

    expect(response.status).toBe(400);
  });
});

describe("integration contact listing", () => {
  it("returns only id, name, dob, mobile and email, and skips admin-added contacts", async () => {
    contactCount.mockResolvedValue(1);
    contactFindMany.mockResolvedValue([
      {
        id: "c1",
        name: "Asha",
        mobile: "9876543210",
        email: "asha@example.com",
        addedByPlatformAdmin: false,
        occasionDates: [
          { occasionId: "occ_birthday", date: new Date(Date.UTC(1990, 7, 15)) },
        ],
      },
    ]);

    const result = await listIntegrationContacts("org_1", {
      page: 1,
      limit: 50,
      updatedSince: "2026-01-01T00:00:00Z",
    });

    expect(result.data).toEqual([
      {
        id: "c1",
        name: "Asha",
        dob: "1990-08-15",
        mobile: "9876543210",
        email: "asha@example.com",
      },
    ]);

    const query = contactFindMany.mock.calls[0][0];
    expect(query.where).toMatchObject({
      organizationId: "org_1",
      isActive: true,
      addedByPlatformAdmin: false,
    });
    expect(query.where.OR).toHaveLength(2);
    expect(Object.keys(query.select).sort()).toEqual([
      "addedByPlatformAdmin",
      "email",
      "id",
      "mobile",
      "name",
      "occasionDates",
    ]);
  });
});
