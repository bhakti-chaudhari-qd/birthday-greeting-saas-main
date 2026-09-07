import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import {
  RateLimitError,
  assertLoginAllowed,
  clearLoginFailures,
  getClientIp,
  loginThrottleKey,
  recordLoginFailure,
} from "@/lib/auth/rate-limit";
import {
  UnifiedLoginError,
  loginUnifiedUser,
} from "@/lib/auth/unified-login";
import { unifiedLoginSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  let throttleKey: string | null = null;

  try {
    const body = await request.json();
    const input = unifiedLoginSchema.parse(body);
    const ip = getClientIp(request);
    throttleKey = loginThrottleKey("unified", ip, input.identifier);

    await assertLoginAllowed(throttleKey);

    try {
      const result = await loginUnifiedUser(input);
      await clearLoginFailures(throttleKey);
      return NextResponse.json({ data: result });
    } catch (error) {
      if (error instanceof UnifiedLoginError) {
        await recordLoginFailure(throttleKey);
        return jsonError(error.message, 401);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid login input", 400, error.flatten());
    }

    if (error instanceof RateLimitError) {
      return jsonError(error.message, 429);
    }

    console.error("Login failed", error);
    return jsonError("Login failed", 500);
  }
}
