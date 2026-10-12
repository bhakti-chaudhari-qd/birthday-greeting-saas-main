import { NextResponse } from "next/server";

import {
  requireApiAdmin,
  sessionAuthErrorResponse,
} from "@/lib/api/api-auth";
import { jsonError } from "@/lib/api/response";
import {
  DeliveryNotFoundError,
  DeliveryRefreshError,
} from "@/lib/deliveries/errors";
import { refreshDeliveryStatus } from "@/lib/deliveries/refresh";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireApiAdmin(request);
    const { id } = await context.params;
    const result = await refreshDeliveryStatus(auth.organizationId, id);

    return NextResponse.json({ data: result });
  } catch (error) {
    const authError = sessionAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    if (error instanceof DeliveryNotFoundError) {
      return jsonError(error.message, 404);
    }

    if (error instanceof DeliveryRefreshError) {
      return jsonError(error.message, 400);
    }

    console.error("Refresh delivery status failed", error);
    return jsonError("Failed to refresh delivery status", 500);
  }
}
