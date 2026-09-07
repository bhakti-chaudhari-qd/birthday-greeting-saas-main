import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import {
  PlatformAdminLoginError,
  loginPlatformAdmin,
} from "@/lib/auth/platform-admin-login";
import {
  RateLimitError,
  assertLoginAllowed,
  clearLoginFailures,
  getClientIp,
  loginThrottleKey,
  recordLoginFailure,
} from "@/lib/auth/rate-limit";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = loginSchema.parse(body);
    const ip = getClientIp(request);
    const throttleKey = loginThrottleKey("platform", ip, input.email);

    await assertLoginAllowed(throttleKey);

    try {
      const result = await loginPlatformAdmin(input);
      await clearLoginFailures(throttleKey);
      return NextResponse.json({ data: result });
    } catch (error) {
      if (error instanceof PlatformAdminLoginError) {
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

    console.error("Platform admin login failed", error);
    return jsonError("Login failed", 500);
  }
}
