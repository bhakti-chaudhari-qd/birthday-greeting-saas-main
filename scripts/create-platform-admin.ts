/**
 * Upsert a Platform Admin account (for production / Vercel DB).
 *
 * Usage:
 *   PLATFORM_ADMIN_EMAIL=admin@example.com \
 *   PLATFORM_ADMIN_PASSWORD='...' \
 *   PLATFORM_ADMIN_NAME='Platform Admin' \
 *   DATABASE_URL='postgresql://...' \
 *   npx tsx scripts/create-platform-admin.ts
 *
 * Or point at a pulled Vercel env file:
 *   PLATFORM_ADMIN_EMAIL=... PLATFORM_ADMIN_PASSWORD=... \
 *   npx tsx scripts/create-platform-admin.ts --env-file=.env.vercel.production
 *
 * Or with local .env / .env.local loaded:
 *   PLATFORM_ADMIN_EMAIL=... PLATFORM_ADMIN_PASSWORD=... npm run admin:create
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

import { loadLocalEnv } from "./load-local-env";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function maskDbHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

function loadEnvFile(filePath: string) {
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);

  if (!existsSync(absolute)) {
    throw new Error(`Env file not found: ${absolute}`);
  }

  for (const line of readFileSync(absolute, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    // Explicit file wins over local .env defaults.
    process.env[key] = value;
  }
}

function resolveEnvFileArg(argv: string[]): string | null {
  const inline = argv.find((arg) => arg.startsWith("--env-file="));
  if (inline) {
    return inline.slice("--env-file=".length) || null;
  }

  const index = argv.indexOf("--env-file");
  if (index >= 0) {
    return argv[index + 1] ?? null;
  }

  return null;
}

async function main() {
  loadLocalEnv();

  const envFile = resolveEnvFileArg(process.argv.slice(2));
  if (envFile) {
    loadEnvFile(envFile);
  }

  const email = requireEnv("PLATFORM_ADMIN_EMAIL").toLowerCase();
  const password = requireEnv("PLATFORM_ADMIN_PASSWORD");
  const name = process.env.PLATFORM_ADMIN_NAME?.trim() || "Platform Admin";

  if (password.length < 10) {
    throw new Error("PLATFORM_ADMIN_PASSWORD must be at least 10 characters");
  }

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("Missing DATABASE_URL");
  }

  console.log(`Target database host: ${maskDbHost(process.env.DATABASE_URL)}`);
  const passwordHash = await hash(password, 12);
  const prisma = new PrismaClient();

  try {
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

    console.log("Platform Admin ready:");
    console.log(`  id: ${admin.id}`);
    console.log(`  email: ${admin.email}`);
    console.log(`  name: ${admin.name}`);
    console.log(`  isActive: ${admin.isActive}`);
    console.log("Sign in at /login on the deployment that uses this database.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
