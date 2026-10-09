import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import {
  PlatformDailySummaryConfigError,
  getPlatformDailySummarySettings,
  updatePlatformDailySummarySchema,
  updatePlatformDailySummarySettings,
} from "@/lib/daily-summary/platform-config";

export const dynamic = "force-dynamic";

/** Platform Admin only: the Meta account + template the daily summary is sent with. */
export async function GET() {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    return NextResponse.json({ data: await getPlatformDailySummarySettings() });
  } catch (error) {
    console.error("Get platform daily summary settings failed", error);
    return jsonError("Failed to load settings", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const input = updatePlatformDailySummarySchema.parse(await request.json());

    return NextResponse.json({
      data: await updatePlatformDailySummarySettings(input),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.issues[0]?.message;
      return jsonError(first ?? "Invalid settings", 400, error.flatten());
    }

    if (error instanceof PlatformDailySummaryConfigError) {
      return jsonError(error.message, 400);
    }

    console.error("Update platform daily summary settings failed", error);
    return jsonError("Failed to save settings", 500);
  }
}
