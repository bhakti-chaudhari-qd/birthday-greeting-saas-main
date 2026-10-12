import { createHash, randomBytes } from "node:crypto";

import { UserRole, type ApiKey } from "@prisma/client";

import type { AuthContext } from "@/lib/auth/types";
import { prisma } from "@/lib/db";

export const API_KEY_TOKEN_PREFIX = "bw_live_";
export const API_KEY_MAX_ACTIVE_PER_ORG = 10;

/** Characters of the raw key kept in clear so the Owner can tell keys apart. */
const API_KEY_DISPLAY_PREFIX_LENGTH = API_KEY_TOKEN_PREFIX.length + 6;
const LAST_USED_WRITE_INTERVAL_MS = 60 * 1000;

export class ApiKeyLimitError extends Error {
  constructor() {
    super(
      `You can have up to ${API_KEY_MAX_ACTIVE_PER_ORG} active API keys. Revoke one to create another.`,
    );
    this.name = "ApiKeyLimitError";
  }
}

export class ApiKeyNotFoundError extends Error {
  constructor() {
    super("API key not found");
    this.name = "ApiKeyNotFoundError";
  }
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function serializeApiKey(apiKey: ApiKey) {
  return {
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
    revokedAt: apiKey.revokedAt?.toISOString() ?? null,
    createdAt: apiKey.createdAt.toISOString(),
  };
}

export async function listApiKeys(organizationId: string) {
  const apiKeys = await prisma.apiKey.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });

  return apiKeys.map(serializeApiKey);
}

/**
 * Creates a full-access key for the organization. The raw key is returned
 * once here and never again - only its SHA-256 hash is stored.
 */
export async function createApiKey(
  organizationId: string,
  createdById: string,
  name: string,
) {
  const activeCount = await prisma.apiKey.count({
    where: { organizationId, revokedAt: null },
  });

  if (activeCount >= API_KEY_MAX_ACTIVE_PER_ORG) {
    throw new ApiKeyLimitError();
  }

  const rawKey = `${API_KEY_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  const apiKey = await prisma.apiKey.create({
    data: {
      organizationId,
      createdById,
      name,
      keyPrefix: rawKey.slice(0, API_KEY_DISPLAY_PREFIX_LENGTH),
      keyHash: hashApiKey(rawKey),
    },
  });

  return { ...serializeApiKey(apiKey), key: rawKey };
}

export async function revokeApiKey(organizationId: string, id: string) {
  const revoked = await prisma.apiKey.updateMany({
    where: { id, organizationId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (revoked.count === 0) {
    const existing = await prisma.apiKey.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      throw new ApiKeyNotFoundError();
    }
  }
}

/**
 * Resolves a raw key to the auth context of its organization. Keys are
 * full-access, so the context carries the Owner role and acts as the user
 * who created the key. Returns null for unknown, revoked, or disabled keys.
 */
export async function authenticateApiKey(
  rawKey: string,
): Promise<{ apiKeyId: string; auth: AuthContext } | null> {
  if (!rawKey.startsWith(API_KEY_TOKEN_PREFIX)) {
    return null;
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(rawKey) },
    include: { organization: true, createdBy: true },
  });

  if (!apiKey || apiKey.revokedAt) {
    return null;
  }

  const { organization, createdBy } = apiKey;

  if (!organization.isActive || !createdBy.isActive) {
    return null;
  }

  if (createdBy.organizationId !== apiKey.organizationId) {
    return null;
  }

  const now = Date.now();
  if (
    !apiKey.lastUsedAt ||
    now - apiKey.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS
  ) {
    await prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date(now) } })
      .catch((error) => {
        console.error("API key lastUsedAt update failed", error);
      });
  }

  return {
    apiKeyId: apiKey.id,
    auth: {
      userId: createdBy.id,
      organizationId: apiKey.organizationId,
      role: UserRole.ADMIN,
      email: createdBy.email,
      name: createdBy.name,
    },
  };
}
