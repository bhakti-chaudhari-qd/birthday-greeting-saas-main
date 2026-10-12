import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as listKeysRoute } from "@/app/api/v1/api-keys/route";
import { GET as listOccasionsRoute } from "@/app/api/v1/occasions/route";
import {
  API_KEY_RATE_MAX_PER_WINDOW,
  requireApiAdmin,
  requireApiAuth,
} from "@/lib/api/api-auth";
import { API_KEY_TOKEN_PREFIX, hashApiKey } from "@/lib/api-keys/service";

const { findUnique, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { apiKey: { findUnique, update } },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, set: vi.fn() })),
}));

vi.mock("@/lib/occasions/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/occasions/service")>()),
  listOccasions: vi.fn(async () => []),
}));

function keyRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: "org_1",
    revokedAt: null,
    lastUsedAt: null,
    organization: { id: "org_1", isActive: true },
    createdBy: {
      id: "user_1",
      organizationId: "org_1",
      isActive: true,
      email: "owner@test.local",
      name: "Owner",
    },
    ...overrides,
  };
}

function bearer(token: string) {
  return new Request("http://localhost/api/v1/occasions", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe("API key request auth", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    update.mockResolvedValue({});
  });

  it("resolves a valid key to an Owner context for its organization", async () => {
    const rawKey = `${API_KEY_TOKEN_PREFIX}valid`;
    findUnique.mockResolvedValue(keyRow("key_valid"));

    const auth = await requireApiAdmin(bearer(rawKey));

    expect(findUnique.mock.calls[0][0].where).toEqual({
      keyHash: hashApiKey(rawKey),
    });
    expect(auth).toMatchObject({
      organizationId: "org_1",
      userId: "user_1",
      role: "ADMIN",
    });
    expect(update).toHaveBeenCalledOnce();
  });

  it("rejects unknown, revoked, and disabled keys without a database hit for foreign tokens", async () => {
    await expect(requireApiAuth(bearer("not-our-token"))).rejects.toThrow(
      "UNAUTHORIZED",
    );
    expect(findUnique).not.toHaveBeenCalled();

    findUnique.mockResolvedValue(null);
    await expect(
      requireApiAuth(bearer(`${API_KEY_TOKEN_PREFIX}unknown`)),
    ).rejects.toThrow("UNAUTHORIZED");

    findUnique.mockResolvedValue(keyRow("key_revoked", { revokedAt: new Date() }));
    await expect(
      requireApiAuth(bearer(`${API_KEY_TOKEN_PREFIX}revoked`)),
    ).rejects.toThrow("UNAUTHORIZED");

    findUnique.mockResolvedValue(
      keyRow("key_org_off", { organization: { id: "org_1", isActive: false } }),
    );
    await expect(
      requireApiAuth(bearer(`${API_KEY_TOKEN_PREFIX}orgoff`)),
    ).rejects.toThrow("UNAUTHORIZED");
  });

  it("serves an opted-in route with a key and returns 401 / 429 through the route", async () => {
    findUnique.mockResolvedValue(keyRow("key_route"));
    const rawKey = `${API_KEY_TOKEN_PREFIX}route`;

    expect((await listOccasionsRoute(bearer(rawKey))).status).toBe(200);

    for (let index = 1; index < API_KEY_RATE_MAX_PER_WINDOW; index += 1) {
      await requireApiAuth(bearer(rawKey));
    }

    const limited = await listOccasionsRoute(bearer(rawKey));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");

    findUnique.mockResolvedValue(null);
    expect(
      (await listOccasionsRoute(bearer(`${API_KEY_TOKEN_PREFIX}bad`))).status,
    ).toBe(401);
  });

  it("keeps key management cookie-only", async () => {
    findUnique.mockResolvedValue(keyRow("key_mgmt"));

    const response = await listKeysRoute();

    expect(response.status).toBe(401);
  });
});
