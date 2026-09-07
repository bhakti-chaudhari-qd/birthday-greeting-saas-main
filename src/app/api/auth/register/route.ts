import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import {
  RateLimitError,
  assertRegistrationAllowed,
  getClientIp,
  recordRegistration,
  registerThrottleKey,
} from "@/lib/auth/rate-limit";
import { RegistrationError, registerOrganization } from "@/lib/auth/register";
import {
  VendorReferralError,
  resolveOptionalVendorReferral,
} from "@/lib/auth/vendor-referral";
import { withTransientDbRetry } from "@/lib/db/transient-retry";
import { registerSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = registerSchema.parse(body);
    const ip = getClientIp(request);
    const throttleKey = registerThrottleKey(ip);

    const result = await withTransientDbRetry(async () => {
      const referredByVendorId = await resolveOptionalVendorReferral(
        input.referralCode,
      );
      await assertRegistrationAllowed(throttleKey);
      return registerOrganization(input, { referredByVendorId });
    });

    try {
      await recordRegistration(throttleKey);
    } catch (error) {
      // Account already created; don't fail signup on throttle bookkeeping.
      console.error("Failed to record registration throttle", error);
    }

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid registration input", 400, error.flatten());
    }

    if (error instanceof VendorReferralError) {
      return jsonError(error.message, 400);
    }

    if (error instanceof RateLimitError) {
      return jsonError(error.message, 429);
    }

    if (error instanceof RegistrationError) {
      return jsonError(error.message, error.code === "CONFLICT" ? 409 : 400);
    }

    console.error("Registration failed", error);
    return jsonError("Registration failed", 500);
  }
}
