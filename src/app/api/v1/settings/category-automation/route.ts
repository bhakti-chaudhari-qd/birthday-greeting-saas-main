import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  CategoryAutomationSettingsError,
  getCategoryAutomationSettings,
  updateCategoryAutomationRules,
} from "@/lib/automation/category-settings";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { updateCategoryAutomationRulesSchema } from "@/lib/validation/category-automation";

export const dynamic = "force-dynamic";

function firstZodMessage(error: ZodError): string {
  return (
    error.issues[0]?.message || "Invalid category automation settings"
  );
}

export async function GET(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const { searchParams } = new URL(request.url);
    const occasionIdParam = searchParams.get("occasionId");
    const occasionId =
      occasionIdParam ||
      (await ensureSystemBirthdayOccasion(auth.organizationId)).id;

    const settings = await getCategoryAutomationSettings(
      auth.organizationId,
      occasionId,
    );

    return NextResponse.json({ data: settings });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof CategoryAutomationSettingsError) {
      return jsonError(error.message, 400);
    }

    console.error("Get category automation settings failed", error);
    return jsonError("Failed to load category automation settings", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = updateCategoryAutomationRulesSchema.parse(body);
    const occasions = await updateCategoryAutomationRules(
      auth.organizationId,
      input,
    );

    // Single-occasion clients historically expected `data.rules`.
    if (occasions.length === 1) {
      return NextResponse.json({ data: occasions[0] });
    }

    return NextResponse.json({ data: { occasions } });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError(firstZodMessage(error), 400, error.flatten());
    }

    if (error instanceof CategoryAutomationSettingsError) {
      return jsonError(error.message, 400);
    }

    console.error("Update category automation settings failed", error);
    return jsonError("Failed to update category automation settings", 500);
  }
}
