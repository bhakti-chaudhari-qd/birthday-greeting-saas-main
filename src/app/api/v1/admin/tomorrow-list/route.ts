import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import {
  PlatformTomorrowListConfigError,
  getPlatformTomorrowListSettings,
  updatePlatformTomorrowListSchema,
  updatePlatformTomorrowListSettings,
} from "@/lib/tomorrow-list/platform-config";

export const dynamic = "force-dynamic";

/** Platform Admin only: the template, default hour and master switch for Tomorrow's List. */
export async function GET() {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    return NextResponse.json({ data: await getPlatformTomorrowListSettings() });
  } catch (error) {
    console.error("Get platform tomorrow list settings failed", error);
    return jsonError("Failed to load settings", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const input = updatePlatformTomorrowListSchema.parse(await request.json());

    return NextResponse.json({
      data: await updatePlatformTomorrowListSettings(input),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.issues[0]?.message;
      return jsonError(first ?? "Invalid settings", 400, error.flatten());
    }

    if (error instanceof PlatformTomorrowListConfigError) {
      return jsonError(error.message, 400);
    }

    console.error("Update platform tomorrow list settings failed", error);
    return jsonError("Failed to save settings", 500);
  }
}
