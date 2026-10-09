import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import {
  DailySummaryValidationError,
  sendDailySummaryTest,
} from "@/lib/daily-summary/service";
import { ProviderSendError } from "@/lib/messaging/providers/types";

export const dynamic = "force-dynamic";

const testSchema = z.object({ mobile: z.string().trim().min(1).max(20) }).strict();

/** Platform Admin only: send one sample summary to check the saved account and template. */
export async function POST(request: Request) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const { mobile } = testSchema.parse(await request.json());
    await sendDailySummaryTest(mobile);

    return NextResponse.json({ data: { sent: true } });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Enter a mobile number", 400);
    }

    if (
      error instanceof DailySummaryValidationError ||
      error instanceof ProviderSendError
    ) {
      return jsonError(error.message, 400);
    }

    console.error("Daily summary test send failed", error);
    return jsonError("Failed to send the test summary", 500);
  }
}
