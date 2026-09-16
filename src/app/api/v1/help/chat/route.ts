import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { answerHelpChat, getSuggestedHelpQuestions } from "@/lib/help/chat";
import type { HelpReplyLanguage } from "@/lib/help/language";
import {
  assertHelpChatAllowed,
  HelpRateLimitError,
} from "@/lib/help/rate-limit";
import { getHelpWidgetDict } from "@/lib/i18n/dictionaries/help-widget";
import { helpChatSchema } from "@/lib/validation/help";

export const dynamic = "force-dynamic";

function parseLang(value: string | null): HelpReplyLanguage {
  return value === "hi" || value === "mr" ? value : "en";
}

export async function GET(request: Request) {
  try {
    await requireSessionAuth();
    const { searchParams } = new URL(request.url);
    const lang = parseLang(searchParams.get("lang"));
    return NextResponse.json({
      data: {
        suggestedQuestions: getSuggestedHelpQuestions(6, lang),
        welcome: getHelpWidgetDict(lang).defaultWelcome,
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
