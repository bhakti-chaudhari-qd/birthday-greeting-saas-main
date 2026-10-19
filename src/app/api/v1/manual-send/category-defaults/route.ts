import { NextResponse } from "next/server";
import { z } from "zod";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { resolveManualSendDefaultsForContacts } from "@/lib/automation/category-settings";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  occasionId: z.string().trim().min(1).optional(),
  contactIds: z
    .string()
    .trim()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().min(1)).min(1).max(200)),
});

export async function GET(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.parse({
      occasionId: searchParams.get("occasionId") ?? undefined,
      contactIds: searchParams.get("contactIds") ?? "",
    });
    const occasionId =
      parsed.occasionId ||
      (await ensureSystemBirthdayOccasion(auth.organizationId)).id;

    const defaults = await resolveManualSendDefaultsForContacts(
      auth.organizationId,
      occasionId,
      parsed.contactIds,
    );

    return NextResponse.json({ data: defaults });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid manual-send defaults request", 400, error.flatten());
    }

    console.error("Resolve manual-send category defaults failed", error);
    return jsonError("Failed to resolve category template defaults", 500);
  }
}
