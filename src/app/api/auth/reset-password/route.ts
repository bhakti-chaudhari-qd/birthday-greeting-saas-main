import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import {
  PasswordResetError,
  resetPasswordWithToken,
} from "@/lib/auth/email-flows";
import {
  RateLimitError,
  clearThrottledAttempts,
  consumeThrottledAttempt,
  getClientIp,
  resetPasswordThrottleKey,
} from "@/lib/auth/rate-limit";
import { resetPasswordSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const throttleKey = resetPasswordThrottleKey(getClientIp(request));

  try {
    const body = await request.json();
    const input = resetPasswordSchema.parse(body);

    // Counted up front; a successful reset clears it again.
    await consumeThrottledAttempt(throttleKey);
    await resetPasswordWithToken(input);
    await clearThrottledAttempts(throttleKey);

    return NextResponse.json({
      data: { message: "Password updated. You can sign in now." },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid input", 400, error.flatten());
    }

    if (error instanceof RateLimitError) {
      return jsonError(error.message, 429);
    }

    if (error instanceof PasswordResetError) {
      return jsonError(error.message, 400);
    }

    console.error("Reset password failed", error);
    return jsonError("Could not reset password", 500);
  }
}
