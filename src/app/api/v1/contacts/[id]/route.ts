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
  ContactDeleteBlockedError,
  ContactNotFoundError,
  ContactValidationError,
} from "@/lib/contacts/errors";
import { shouldMaskAdminAddedContactsForViewer } from "@/lib/contacts/mask";
import {
  deleteContact,
  getContactById,
  serializeContact,
  updateContact,
} from "@/lib/contacts/service";
import { updateContactSchema } from "@/lib/validation/contact";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAuth();
    const { id } = await context.params;
    const contact = await getContactById(auth.organizationId, id);

    return NextResponse.json({
      data: serializeContact(contact, {
        maskAdminAdded: await shouldMaskAdminAddedContactsForViewer(
          auth.organizationId,
          auth.role,
        ),
      }),
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ContactNotFoundError) {
      return jsonError(error.message, 404);
    }

    console.error("Get contact failed", error);
    return jsonError("Failed to get contact", 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAuth();
    const { id } = await context.params;
    const body = await request.json();
    const input = updateContactSchema.parse(body);
    const contact = await updateContact(auth.organizationId, id, input);

    return NextResponse.json({
      data: serializeContact(contact, {
        maskAdminAdded: await shouldMaskAdminAddedContactsForViewer(
          auth.organizationId,
          auth.role,
        ),
      }),
    });
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

    if (error instanceof ContactNotFoundError) {
      return jsonError(error.message, 404);
    }

    if (error instanceof ContactConflictError) {
      return jsonError(error.message, 409);
    }

    console.error("Update contact failed", error);
    return jsonError("Failed to update contact", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSessionAuth();
    const { id } = await context.params;
    await deleteContact(auth.organizationId, id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ContactNotFoundError) {
      return jsonError(error.message, 404);
    }

    if (error instanceof ContactDeleteBlockedError) {
      return jsonError(error.message, 409);
    }

    console.error("Delete contact failed", error);
    return jsonError("Failed to delete contact", 500);
  }
}
