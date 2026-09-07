import { NextResponse } from "next/server";
import { z } from "zod";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const greetingPreviewSchema = z.object({
  recipientName: z.string().trim().min(1).max(80),
  occasionName: z.string().trim().min(1).max(50).default("Birthday"),
});

export async function POST(request: Request) {
  try {
    await requireSessionAuth();
    const input = greetingPreviewSchema.parse(await request.json());

    // Dynamic import so native canvas/ffmpeg stay external to the route bundle.
    const { renderPersonalizedGreetingVideo } = await import(
      "@/lib/media/personalized-greeting-video"
    );

    const rendered = await renderPersonalizedGreetingVideo({
      occasionName: input.occasionName,
      recipientName: input.recipientName,
    });

    return new NextResponse(new Uint8Array(rendered.bytes), {
      headers: {
        "Content-Type": rendered.contentType,
        "Content-Length": String(rendered.bytes.length),
        "Content-Disposition": `inline; filename="${rendered.filename.replaceAll('"', "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof z.ZodError) {
      return jsonError("Invalid greeting preview request", 400, error.flatten());
    }

    console.error("Greeting video preview failed", error);
    return jsonError("Failed to build greeting preview", 500);
  }
}
