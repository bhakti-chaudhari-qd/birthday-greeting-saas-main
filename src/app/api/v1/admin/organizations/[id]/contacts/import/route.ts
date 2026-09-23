import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/api/response";
import { importContactsForPlatformAdmin } from "@/lib/admin/contacts";
import { PlatformAdminOrgError } from "@/lib/admin/org-ops";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import { ContactValidationError } from "@/lib/contacts/errors";
import { importContactsBodySchema } from "@/lib/validation/contact-csv";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const { id } = await context.params;
    const body = await request.json();
    const input = importContactsBodySchema.parse(body);

    const summary = await importContactsForPlatformAdmin({
      actorAdminId: admin.adminId,
      organizationId: id,
      csv: input.csv,
      excelBase64: input.excelBase64,
      fileName: input.fileName,
      fieldMappings: input.fieldMappings,
    });

    return NextResponse.json({ data: summary });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError("Invalid import input", 400, error.flatten());
    }

    if (error instanceof PlatformAdminOrgError) {
      return jsonError(error.message, 404);
    }

    if (error instanceof ContactValidationError) {
      return jsonError(error.message, 400);
    }

    console.error("Import contacts for platform admin failed", error);
    return jsonError("Failed to import contacts", 500);
  }
}
