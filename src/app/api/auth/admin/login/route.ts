import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import {
  PlatformAdminLoginError,
  loginPlatformAdmin,
} from "@/lib/auth/platform-admin-login";
import {
  RateLimitError,
  clearLoginAttempts,
  consumeLoginAttempt,
  getClientIp,
  loginThrottleKeys,
} from "@/lib/auth/rate-limit";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = loginSchema.parse(body);
    const ip = getClientIp(request);
    const throttleKeys = loginThrottleKeys("platform", ip, input.email);

    // Counted up front; a successful sign-in clears it again.
    await consumeLoginAttempt(throttleKeys);

    try {
      const result = await loginPlatformAdmin(input);
      await clearLoginAttempts(throttleKeys);
      return NextResponse.json({ data: result });
    } catch (error) {
      if (error instanceof PlatformAdminLoginError) {
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
