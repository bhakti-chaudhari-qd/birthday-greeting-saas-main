import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  getMessageLengthHint,
  rewriteMessage,
} from "@/lib/ai/suggest-message";
import { rewriteMessageSchema } from "@/lib/validation/ai";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = rewriteMessageSchema.parse(body);
    const result = await rewriteMessage(input, {
      organizationId: auth.organizationId,
    });

    return NextResponse.json({
      data: {
        ...result,
        lengthHint: getMessageLengthHint(result.body, input.channel),
      },
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid AI rewrite input", 400, error.flatten());
    }

    console.error("AI rewrite-message failed", error);
    return jsonError("Failed to rewrite the message", 500);
  }
}
