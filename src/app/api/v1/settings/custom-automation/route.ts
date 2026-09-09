import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  CustomAutomationSettingsError,
  getCustomAutomationSettings,
  updateCustomAutomationSettings,
} from "@/lib/automation/custom-settings";
import { updateCustomAutomationSettingsSchema } from "@/lib/validation/custom-automation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSessionAdmin();
    const settings = await getCustomAutomationSettings(auth.organizationId);

    return NextResponse.json({ data: settings });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof CustomAutomationSettingsError) {
      return jsonError(error.message, 400);
    }

    console.error("Get custom automation settings failed", error);
    return jsonError("Failed to load custom automation settings", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = updateCustomAutomationSettingsSchema.parse(body);
    const settings = await updateCustomAutomationSettings(
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
        "Invalid custom automation settings",
        400,
        error.flatten(),
      );
    }

    if (error instanceof CustomAutomationSettingsError) {
      return jsonError(error.message, 400);
    }

    console.error("Update custom automation settings failed", error);
    return jsonError("Failed to update custom automation settings", 500);
  }
}
