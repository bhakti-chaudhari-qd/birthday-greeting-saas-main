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
import { VendorLoginError, loginVendorUser } from "@/lib/auth/vendor-login";
import { unifiedLoginSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = unifiedLoginSchema.parse(body);
    const ip = getClientIp(request);
    const throttleKey = loginThrottleKey("vendor", ip, input.identifier);

    await assertLoginAllowed(throttleKey);

    try {
      const result = await loginVendorUser(input);
      await clearLoginFailures(throttleKey);
      return NextResponse.json({ data: result });
    } catch (error) {
      if (error instanceof VendorLoginError) {
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

    console.error("Vendor login failed", error);
    return jsonError("Login failed", 500);
  }
}
