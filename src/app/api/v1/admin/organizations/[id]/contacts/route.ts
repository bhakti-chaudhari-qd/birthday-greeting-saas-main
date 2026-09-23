import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import { addContactForPlatformAdmin } from "@/lib/admin/contacts";
import { PlatformAdminOrgError } from "@/lib/admin/org-ops";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import {
  ContactConflictError,
  ContactLimitError,
  ContactValidationError,
} from "@/lib/contacts/errors";
import { serializeContact } from "@/lib/contacts/serialize";
import { createContactSchema } from "@/lib/validation/contact";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const addContactSchema = createContactSchema
  .innerType()
  .pick({ name: true, mobile: true, email: true, categoryName: true })
  .extend({
    /** Any format parseOccasionDate accepts, e.g. an <input type="date"> value. */
    birthday: z.string().trim().min(1).optional(),
  })
  .strict();

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const { id } = await context.params;
    const body = await request.json();
    const input = addContactSchema.parse(body);

    const contact = await addContactForPlatformAdmin({
      actorAdminId: admin.adminId,
      organizationId: id,
      name: input.name,
      mobile: input.mobile,
      email: input.email,
      birthday: input.birthday,
      categoryName: input.categoryName,
    });

    return NextResponse.json(
      { data: serializeContact(contact) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid contact", 400, error.flatten());
    }

    if (error instanceof PlatformAdminOrgError) {
      return jsonError(error.message, 404);
    }

    if (error instanceof ContactValidationError) {
      return jsonError(error.message, 400);
    }

    if (error instanceof ContactConflictError) {
      return jsonError(error.message, 409);
    }

    if (error instanceof ContactLimitError) {
      return jsonError(error.message, 402);
    }

    console.error("Add contact for platform admin failed", error);
    return jsonError("Failed to add contact", 500);
  }
}
