import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import {
  TomorrowListTemplateError,
  getTomorrowListTemplateStatus,
  submitTomorrowListTemplate,
  submitTomorrowListTemplateSchema,
} from "@/lib/tomorrow-list/meta-template";

export const dynamic = "force-dynamic";

/** Platform Admin only: Meta's approval status of the saved Tomorrow's List template. */
export async function GET() {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    return NextResponse.json({ data: await getTomorrowListTemplateStatus() });
  } catch (error) {
    if (error instanceof TomorrowListTemplateError) {
      return jsonError(error.message, 400);
    }

    console.error("Tomorrow list template status failed", error);
    return jsonError("Failed to check the template status", 500);
  }
}

/** Platform Admin only: submit the Tomorrow's List template to Meta for approval. */
export async function POST(request: Request) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const input = submitTomorrowListTemplateSchema.parse(await request.json());

    return NextResponse.json({ data: await submitTomorrowListTemplate(input) });
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.issues[0]?.message;
      return jsonError(first ?? "Invalid template", 400, error.flatten());
    }

    if (error instanceof TomorrowListTemplateError) {
      return jsonError(error.message, 400);
    }

    console.error("Tomorrow list template submit failed", error);
    return jsonError("Failed to submit the template", 500);
  }
}
