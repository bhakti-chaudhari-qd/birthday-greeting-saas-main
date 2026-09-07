import {
  ACCOUNT_DEACTIVATED_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
} from "@/lib/auth/constants";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { LoginInput } from "@/lib/validation/auth";

export class LoginError extends Error {
  constructor(message = INVALID_CREDENTIALS_MESSAGE) {
    super(message);
    this.name = "LoginError";
  }
}

export async function authenticateUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    include: { organization: true },
  });

  if (!user) {
    throw new LoginError();
  }

  const passwordValid = await verifyPassword(input.password, user.passwordHash);

  if (!passwordValid) {
    throw new LoginError();
  }

  if (!user.isActive || !user.organization.isActive) {
    throw new LoginError(ACCOUNT_DEACTIVATED_MESSAGE);
  }

  return user;
}

export async function loginUser(input: LoginInput) {
  const user = await authenticateUser(input);

  await createSession(user.id, user.organizationId);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    },
  };
}
