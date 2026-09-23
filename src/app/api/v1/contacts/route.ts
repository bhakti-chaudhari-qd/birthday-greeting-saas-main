import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  requireSessionAuth,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { ContactFieldValidationError } from "@/lib/contact-fields/service";
import {
  ContactConflictError,
  ContactLimitError,
  ContactValidationError,
} from "@/lib/contacts/errors";
import { shouldMaskAdminAddedContactsForViewer } from "@/lib/contacts/mask";
import {
  createContact,
  listContacts,
  serializeContact,
} from "@/lib/contacts/service";
import {
  createContactSchema,
  listContactsQuerySchema,
} from "@/lib/validation/contact";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireSessionAuth();
    const body = await request.json();
    const input = createContactSchema.parse(body);

    const contact = await createContact(auth.organizationId, input);

    return NextResponse.json(
      { data: serializeContact(contact) },
      { status: 201 },
    );
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid contact input", 400, error.flatten());
    }

    if (
      error instanceof ContactValidationError ||
      error instanceof ContactFieldValidationError
    ) {
      return jsonError(error.message, 400);
    }

    if (error instanceof ContactConflictError) {
      return jsonError(error.message, 409);
    }

    if (error instanceof ContactLimitError) {
      return jsonError(error.message, 402);
    }

    console.error("Create contact failed", error);
    return jsonError("Failed to create contact", 500);
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireSessionAuth();
    const { searchParams } = new URL(request.url);
    const query = listContactsQuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      isActive: searchParams.get("isActive") ?? undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      occasionId: searchParams.get("occasionId") ?? undefined,
    });

    const result = await listContacts(auth.organizationId, query, {
      maskAdminAdded: await shouldMaskAdminAddedContactsForViewer(
        auth.organizationId,
        auth.role,
      ),
    });

    return NextResponse.json(result);
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid query parameters", 400, error.flatten());
    }

    console.error("List contacts failed", error);
    return jsonError("Failed to list contacts", 500);
  }
}
