import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import {
  ApiKeyLimitError,
  createApiKey,
  listApiKeys,
} from "@/lib/api-keys/service";

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
  })
  .strict();

/**
 * Owner-only, dashboard session only: API keys cannot be listed, created,
 * or revoked with an API key.
 */
export async function GET() {
  try {
    const auth = await requireSessionAdmin();

    return NextResponse.json({ data: await listApiKeys(auth.organizationId) });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("List API keys failed", error);
    return jsonError("Failed to load API keys", 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const input = createSchema.parse(await request.json());
    const data = await createApiKey(
      auth.organizationId,
      auth.userId,
      input.name,
    );

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid API key input", 400, error.flatten());
    }

    if (error instanceof ApiKeyLimitError) {
      return jsonError(error.message, 400);
    }

    console.error("Create API key failed", error);
    return jsonError("Failed to create API key", 500);
  }
}
