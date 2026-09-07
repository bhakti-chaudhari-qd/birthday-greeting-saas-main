import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";

import { jsonError } from "@/lib/api/response";
import { STRONG_PASSWORD_MESSAGE, isStrongPassword } from "@/lib/auth/password-policy";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const bootstrapBodySchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(1)
    .max(128)
    .refine(isStrongPassword, STRONG_PASSWORD_MESSAGE),
  name: z.string().trim().min(1).max(120).optional(),
});

function safeCompareSecrets(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function requireBootstrapSecret(request: Request): void {
  if (process.env.PLATFORM_ADMIN_BOOTSTRAP_ENABLED?.trim() !== "1") {
    throw new Error("DISABLED");
  }

  const configuredSecret = process.env.PLATFORM_ADMIN_BOOTSTRAP_SECRET?.trim();
  if (!configuredSecret) {
    throw new Error("DISABLED");
  }

  const authorization = request.headers.get("authorization");
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? "");
  if (!match?.[1] || !safeCompareSecrets(match[1], configuredSecret)) {
    throw new Error("UNAUTHORIZED");
  }
}

/**
 * One-shot Platform Admin upsert for production bootstrap.
 * Disabled unless PLATFORM_ADMIN_BOOTSTRAP_ENABLED=1 and secret matches.
 */
export async function POST(request: Request) {
  try {
    requireBootstrapSecret(request);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    return jsonError("Not found", 404);
  }

  try {
    const json = await request.json();
    const parsed = bootstrapBodySchema.safeParse(json);

    if (!parsed.success) {
      return jsonError("Invalid input", 400, parsed.error.flatten());
    }

    const { email, password } = parsed.data;
    const name = parsed.data.name?.trim() || "Platform Admin";
    const passwordHash = await hash(password, 12);

    const admin = await prisma.platformAdmin.upsert({
      where: { email },
      update: {
        passwordHash,
        name,
        isActive: true,
      },
      create: {
        email,
        passwordHash,
        name,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      data: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        isActive: admin.isActive,
      },
    });
  } catch (error) {
    console.error("Platform admin bootstrap failed", error);
    return jsonError("Failed to bootstrap platform admin", 500);
  }
}
