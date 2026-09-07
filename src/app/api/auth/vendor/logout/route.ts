import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import { destroyVendorSession } from "@/lib/auth/vendor-session";

export async function POST() {
  try {
    await destroyVendorSession();
    return NextResponse.json({ data: { ok: true } });
  } catch (error) {
    console.error("Vendor logout failed", error);
    return jsonError("Logout failed", 500);
  }
}
