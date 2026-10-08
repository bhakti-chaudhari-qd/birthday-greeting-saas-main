import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import { checkMetaWhatsAppHealthForPlatformAdmin } from "@/lib/admin/channel-status";
import { PlatformAdminOrgError } from "@/lib/admin/org-ops";
import { getPlatformAdminContext } from "@/lib/auth/platform-admin-session";
import { ProviderSendError } from "@/lib/messaging/providers/types";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const admin = await getPlatformAdminContext();
    if (!admin) {
      return jsonError("Authentication required", 401);
    }

    const { id } = await context.params;
    const health = await checkMetaWhatsAppHealthForPlatformAdmin(id);

    return NextResponse.json({ data: { health } });
  } catch (error) {
    if (
      error instanceof PlatformAdminOrgError ||
      error instanceof ProviderSendError
    ) {
      return jsonError(error.message, 400);
    }

    console.error("WhatsApp health check for platform admin failed", error);
    return jsonError("Failed to check WhatsApp health", 500);
  }
}
