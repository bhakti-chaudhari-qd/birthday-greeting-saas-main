import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  getMessageLengthHint,
  suggestMessage,
  suggestMessageVariants,
} from "@/lib/ai/suggest-message";
import { suggestMessageSchema } from "@/lib/validation/ai";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const body = await request.json();
    const input = suggestMessageSchema.parse(body);

    if ((input.variantCount ?? 1) > 1) {
      const result = await suggestMessageVariants(input, {
        organizationId: auth.organizationId,
      });
      const lengthHints = result.variants.map((variant) =>
        getMessageLengthHint(variant, input.channel),
      );
      return NextResponse.json({
        data: {
          ...result,
          lengthHints,
        },
      });
    }

    const result = await suggestMessage(input, {
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
      return jsonError("Invalid AI suggest input", 400, error.flatten());
    }

    console.error("AI suggest-message failed", error);
    return jsonError("Failed to suggest a message", 500);
  }
}
