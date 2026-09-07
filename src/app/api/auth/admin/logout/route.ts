import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import { destroyPlatformAdminSession } from "@/lib/auth/platform-admin-session";

export async function POST() {
  try {
    await destroyPlatformAdminSession();
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    console.error("Platform admin logout failed", error);
    return jsonError("Logout failed", 500);
  }
}
