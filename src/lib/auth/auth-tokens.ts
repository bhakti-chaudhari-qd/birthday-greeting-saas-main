import { createHash, randomBytes } from "node:crypto";

import { AuthTokenPurpose } from "@prisma/client";

import { prisma } from "@/lib/db";

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export function hashAuthToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generateRawAuthToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function issueAuthToken(input: {
  userId: string;
  purpose: AuthTokenPurpose;
  ttlMs: number;
}): Promise<string> {
  const rawToken = generateRawAuthToken();
  const tokenHash = hashAuthToken(rawToken);
  const expiresAt = new Date(Date.now() + input.ttlMs);

  // Invalidate prior unused tokens of the same purpose
  await prisma.authToken.updateMany({
    where: {
      userId: input.userId,
      purpose: input.purpose,
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });

  await prisma.authToken.create({
    data: {
      userId: input.userId,
      purpose: input.purpose,
      tokenHash,
      expiresAt,
    },
  });

  return rawToken;
}

export async function consumeAuthToken(input: {
  rawToken: string;
  purpose: AuthTokenPurpose;
}): Promise<{ userId: string } | null> {
  const tokenHash = hashAuthToken(input.rawToken);
  const now = new Date();

  // Atomically claim the token: only the first caller flips usedAt from null,
  // so two requests racing the same reset link cannot both succeed.
  const claimed = await prisma.authToken.updateMany({
    where: {
      tokenHash,
      purpose: input.purpose,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: { usedAt: now },
  });

  if (claimed.count !== 1) {
    return null;
  }

  const record = await prisma.authToken.findUnique({
    where: { tokenHash },
    select: { userId: true },
  });

  return record ? { userId: record.userId } : null;
}
