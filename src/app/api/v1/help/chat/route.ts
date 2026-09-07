import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { answerHelpChat, getSuggestedHelpQuestions } from "@/lib/help/chat";
import {
  assertHelpChatAllowed,
  HelpRateLimitError,
} from "@/lib/help/rate-limit";
import { helpChatSchema } from "@/lib/validation/help";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSessionAuth();
    return NextResponse.json({
      data: {
        suggestedQuestions: getSuggestedHelpQuestions(6),
        welcome:
          "Hi! I can help with contacts, templates, automations, SMS/WhatsApp setup, roles, and billing. Ask in English, हिंदी, or मराठी - I'll reply in the same language.",
      },
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }
    console.error("Help chat bootstrap failed", error);
    return jsonError("Failed to load help", 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAuth();
    assertHelpChatAllowed(auth.organizationId);

    const body = await request.json();
    const input = helpChatSchema.parse(body);
    const result = await answerHelpChat(input, {
      organizationId: auth.organizationId,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof HelpRateLimitError) {
      return jsonError(error.message, 429);
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid help chat input", 400, error.flatten());
    }

    console.error("Help chat failed", error);
    return jsonError("Failed to answer help question", 500);
  }
}
