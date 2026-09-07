import { AuthTokenPurpose } from "@prisma/client";

import {
  PASSWORD_RESET_TTL_MS,
  consumeAuthToken,
  issueAuthToken,
} from "@/lib/auth/auth-tokens";
import { hashPassword } from "@/lib/auth/password";
import { sendPasswordResetEmail } from "@/lib/email/send";
import { prisma } from "@/lib/db";
import type {
  ForgotPasswordInput,
  ResetPasswordInput,
} from "@/lib/validation/auth";

export class PasswordResetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordResetError";
  }
}

export async function sendPasswordResetForUser(user: {
  id: string;
  email: string;
}): Promise<void> {
  const rawToken = await issueAuthToken({
    userId: user.id,
    purpose: AuthTokenPurpose.PASSWORD_RESET,
    ttlMs: PASSWORD_RESET_TTL_MS,
  });

  await sendPasswordResetEmail(user.email, rawToken);
}

/**
 * Always succeeds from the caller's perspective (no email enumeration).
 */
export async function requestPasswordReset(
  input: ForgotPasswordInput,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (!user || !user.isActive) {
    return;
  }

  await sendPasswordResetForUser(user);
}

export async function resetPasswordWithToken(
  input: ResetPasswordInput,
): Promise<void> {
  const consumed = await consumeAuthToken({
    rawToken: input.token,
    purpose: AuthTokenPurpose.PASSWORD_RESET,
  });

  if (!consumed) {
    throw new PasswordResetError("This reset link is invalid or has expired");
  }

  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: consumed.userId },
      data: { passwordHash },
    });
    // Invalidate all sessions after password change
    await tx.session.deleteMany({ where: { userId: consumed.userId } });
  });
}
