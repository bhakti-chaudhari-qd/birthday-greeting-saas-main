import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import { requestPasswordReset } from "@/lib/auth/email-flows";
import {
  RateLimitError,
  assertLoginAllowed,
  getClientIp,
  loginThrottleKey,
  recordLoginFailure,
} from "@/lib/auth/rate-limit";
import { forgotPasswordSchema } from "@/lib/validation/auth";

const GENERIC_MESSAGE =
  "If an account exists for that email, a reset link has been sent.";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = forgotPasswordSchema.parse(body);
    const ip = getClientIp(request);
    const throttleKey = loginThrottleKey("forgot", ip, input.email);

    await assertLoginAllowed(throttleKey);
    await requestPasswordReset(input);
    // Count as a hit so this endpoint cannot be spammed without lockout.
    await recordLoginFailure(throttleKey);

    return NextResponse.json({ data: { message: GENERIC_MESSAGE } });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid input", 400, error.flatten());
    }

    if (error instanceof RateLimitError) {
      return jsonError(error.message, 429);
    }

    console.error("Forgot password failed", error);
    // Still generic - do not leak existence; avoid 500 for mail misconfig in prod if possible
    return NextResponse.json({ data: { message: GENERIC_MESSAGE } });
  }
}
