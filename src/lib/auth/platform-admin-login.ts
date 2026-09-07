import { INVALID_CREDENTIALS_MESSAGE } from "@/lib/auth/constants";
import { verifyPassword } from "@/lib/auth/password";
import { createPlatformAdminSession } from "@/lib/auth/platform-admin-session";
import { prisma } from "@/lib/db";
import type { LoginInput } from "@/lib/validation/auth";

export class PlatformAdminLoginError extends Error {
  constructor(message = INVALID_CREDENTIALS_MESSAGE) {
    super(message);
    this.name = "PlatformAdminLoginError";
  }
}

export async function authenticatePlatformAdmin(input: LoginInput) {
  const admin = await prisma.platformAdmin.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (!admin || !admin.isActive) {
    throw new PlatformAdminLoginError();
  }

  const passwordValid = await verifyPassword(input.password, admin.passwordHash);
  if (!passwordValid) {
    throw new PlatformAdminLoginError();
  }

  return admin;
}

export async function loginPlatformAdmin(input: LoginInput) {
  const admin = await authenticatePlatformAdmin(input);
  await createPlatformAdminSession(admin.id);

  return {
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
    },
  };
}
