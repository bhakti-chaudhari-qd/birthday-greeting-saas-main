import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { apiKeyAuthErrorResponse, requireApiKey } from "@/lib/api/api-auth";
import { jsonError } from "@/lib/api/response";
import {
  listIntegrationContacts,
  listIntegrationContactsQuerySchema,
  upsertIntegrationContacts,
  upsertIntegrationContactsSchema,
} from "@/lib/integrations/contacts";

export const dynamic = "force-dynamic";

/**
 * The only route an API key can call. Exposes name, dob, mobile and email
 * of the key's organization's contacts - nothing else.
 */
export async function GET(request: Request) {
  try {
    const { organizationId } = await requireApiKey(request);
    const { searchParams } = new URL(request.url);
    const query = listIntegrationContactsQuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      updatedSince: searchParams.get("updatedSince") ?? undefined,
      mobile: searchParams.get("mobile") ?? undefined,
    });

    return NextResponse.json(
      await listIntegrationContacts(organizationId, query),
    );
  } catch (error) {
    const authError = apiKeyAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid query parameters", 400, error.flatten());
    }

    console.error("Integration list contacts failed", error);
    return jsonError("Failed to list contacts", 500);
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId } = await requireApiKey(request);
    const input = upsertIntegrationContactsSchema.parse(await request.json());
    const results = await upsertIntegrationContacts(
      organizationId,
      input.contacts,
    );

    return NextResponse.json({
      data: results,
      meta: {
        created: results.filter((row) => row.status === "created").length,
        updated: results.filter((row) => row.status === "updated").length,
        failed: results.filter((row) => row.status === "error").length,
      },
    });
  } catch (error) {
    const authError = apiKeyAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid contacts input", 400, error.flatten());
    }

    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON", 400);
    }

    console.error("Integration upsert contacts failed", error);
    return jsonError("Failed to save contacts", 500);
  }
}
