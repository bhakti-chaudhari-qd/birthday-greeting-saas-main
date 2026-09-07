import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import {
  RateLimitError,
  consumeVendorRegistrationAttempt,
  getClientIp,
} from "@/lib/auth/rate-limit";
import {
  INVALID_VENDOR_INVITE_MESSAGE,
  VendorRegistrationError,
  hashVendorRegistrationToken,
  inspectVendorRegistrationInvite,
  registerInvitedVendor,
} from "@/lib/auth/vendor-registration";
import { vendorRegistrationSchema } from "@/lib/validation/auth";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

export async function POST(request: Request) {
  try {
    const input = vendorRegistrationSchema.parse(await request.json());
    const tokenHash = hashVendorRegistrationToken(input.token);
    if (!(await inspectVendorRegistrationInvite(input.token))) {
      const response = jsonError(INVALID_VENDOR_INVITE_MESSAGE, 400);
      Object.entries(RESPONSE_HEADERS).forEach(([name, value]) =>
        response.headers.set(name, value),
      );
      return response;
    }

    await consumeVendorRegistrationAttempt(
      getClientIp(request),
      tokenHash,
    );
    const result = await registerInvitedVendor(input);

    return NextResponse.json(
      { data: result },
      { status: 201, headers: RESPONSE_HEADERS },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      const invalidToken = error.issues.some(
        (issue) => issue.path[0] === "token",
      );
      const response = invalidToken
        ? jsonError(INVALID_VENDOR_INVITE_MESSAGE, 400)
        : jsonError("Invalid registration input", 400, error.flatten());
      Object.entries(RESPONSE_HEADERS).forEach(([name, value]) =>
        response.headers.set(name, value),
      );
      return response;
    }

    if (error instanceof SyntaxError) {
      const response = jsonError("Invalid registration input", 400);
      Object.entries(RESPONSE_HEADERS).forEach(([name, value]) =>
        response.headers.set(name, value),
      );
      return response;
    }

    if (error instanceof RateLimitError) {
      const response = jsonError(error.message, 429);
      Object.entries(RESPONSE_HEADERS).forEach(([name, value]) =>
        response.headers.set(name, value),
      );
      return response;
    }

    if (error instanceof VendorRegistrationError) {
      const response = jsonError(
        error.message,
        error.code === "CONFLICT" ? 409 : 400,
      );
      Object.entries(RESPONSE_HEADERS).forEach(([name, value]) =>
        response.headers.set(name, value),
      );
      return response;
    }

    console.error("Vendor registration failed", error);
    const response = jsonError("Vendor registration failed", 500);
    Object.entries(RESPONSE_HEADERS).forEach(([name, value]) =>
      response.headers.set(name, value),
    );
    return response;
  }
}
