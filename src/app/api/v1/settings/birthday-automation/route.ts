import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  BirthdayAutomationSettingsError,
  getBirthdayAutomationSettings,
  updateBirthdayAutomationSettings,
} from "@/lib/automation/settings";
import { updateBirthdayAutomationSettingsSchema } from "@/lib/validation/birthday-automation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSessionAdmin();
    const settings = await getBirthdayAutomationSettings(auth.organizationId);

    return NextResponse.json({ data: settings });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof BirthdayAutomationSettingsError) {
      return jsonError(error.message, 400);
    }

    console.error("Get birthday automation settings failed", error);
    return jsonError("Failed to load birthday automation settings", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = updateBirthdayAutomationSettingsSchema.parse(body);
    const settings = await updateBirthdayAutomationSettings(
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
      return jsonError("Invalid birthday automation settings", 400, error.flatten());
    }

    if (error instanceof BirthdayAutomationSettingsError) {
      return jsonError(error.message, 400);
    }

    console.error("Update birthday automation settings failed", error);
    return jsonError("Failed to update birthday automation settings", 500);
  }
}
