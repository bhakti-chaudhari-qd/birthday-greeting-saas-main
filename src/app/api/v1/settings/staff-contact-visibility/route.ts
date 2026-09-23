import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  requireSessionAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/session-auth";
import { jsonError } from "@/lib/api/response";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  staffCanViewContactDetails: z.boolean(),
});

/** Owner-only: reads both the Owner's own choice and the admin ceiling, so the UI can explain why it's disabled. */
export async function GET() {
  try {
    const auth = await requireSessionAdmin();

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: auth.organizationId },
      select: {
        staffContactVisibilityAdminAllowed: true,
        staffContactVisibilityOwnerAllowed: true,
      },
    });

    return NextResponse.json({
      data: {
        staffCanViewContactDetails:
          organization.staffContactVisibilityOwnerAllowed,
        adminAllowed: organization.staffContactVisibilityAdminAllowed,
      },
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Get staff contact visibility setting failed", error);
    return jsonError("Failed to load setting", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSessionAdmin();
    const input = updateSchema.parse(await request.json());

    const organization = await prisma.organization.update({
      where: { id: auth.organizationId },
      data: {
        staffContactVisibilityOwnerAllowed: input.staffCanViewContactDetails,
      },
      select: {
        staffContactVisibilityAdminAllowed: true,
        staffContactVisibilityOwnerAllowed: true,
      },
    });

    return NextResponse.json({
      data: {
        staffCanViewContactDetails:
          organization.staffContactVisibilityOwnerAllowed,
        adminAllowed: organization.staffContactVisibilityAdminAllowed,
      },
    });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof ZodError) {
      return jsonError("Invalid input", 400, error.flatten());
    }

    console.error("Update staff contact visibility setting failed", error);
    return jsonError("Failed to save setting", 500);
  }
}
