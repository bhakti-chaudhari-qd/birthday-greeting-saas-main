import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  PlatformAdminOrgError,
  PlatformAdminOrgInactiveError,
  sendOrganizationUserPasswordResetForPlatformAdmin,
} from "@/lib/admin/org-ops";
import { jsonError } from "@/lib/api/response";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import { RateLimitError } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string; userId: string }>;
};

const noInputSchema = z.object({}).strict();

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      noInputSchema.parse(await request.json());
    }

    const { id, userId } = await context.params;
    await sendOrganizationUserPasswordResetForPlatformAdmin({
      adminId: admin.adminId,
      organizationId: id,
      userId,
    });

    return NextResponse.json({
      data: { message: "Password reset email sent" },
    });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return jsonError("Password reset request does not accept input", 400);
    }

    if (error instanceof PlatformAdminOrgError) {
      return jsonError(error.message, 404);
    }

    if (error instanceof PlatformAdminOrgInactiveError) {
      return jsonError(error.message, 409);
    }

    if (error instanceof RateLimitError) {
      return jsonError(error.message, 429);
    }

    console.error("Send organization user password reset failed", error);
    return jsonError("Failed to send password reset email", 500);
  }
}
