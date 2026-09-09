import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  AnniversaryAutomationSettingsError,
  getAnniversaryAutomationSettings,
  updateAnniversaryAutomationSettings,
} from "@/lib/automation/anniversary-settings";
import { updateAnniversaryAutomationSettingsSchema } from "@/lib/validation/anniversary-automation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSessionAdmin();
    const settings = await getAnniversaryAutomationSettings(auth.organizationId);

    return NextResponse.json({ data: settings });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof AnniversaryAutomationSettingsError) {
      return jsonError(error.message, 400);
    }

    console.error("Get anniversary automation settings failed", error);
    return jsonError("Failed to load anniversary automation settings", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = updateAnniversaryAutomationSettingsSchema.parse(body);
    const settings = await updateAnniversaryAutomationSettings(
      auth.organizationId,
      input,
    );

    return NextResponse.json({ data: settings });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError(
        "Invalid anniversary automation settings",
        400,
        error.flatten(),
      );
    }

    if (error instanceof AnniversaryAutomationSettingsError) {
      return jsonError(error.message, 400);
    }

    console.error("Update anniversary automation settings failed", error);
    return jsonError("Failed to update anniversary automation settings", 500);
  }
}
