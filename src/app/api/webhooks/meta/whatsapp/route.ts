import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import {
  applyMetaStatusUpdate,
  extractMetaStatusUpdates,
  getMetaWebhookConfig,
  verifyMetaWebhookSignature,
} from "@/lib/deliveries/meta-webhook";

export const dynamic = "force-dynamic";

/** Meta's one-time handshake when the callback URL is saved in the app dashboard. */
export async function GET(request: Request) {
  const config = getMetaWebhookConfig();
  if (!config) {
    return jsonError("WhatsApp webhook is not configured", 503);
  }

  const params = new URL(request.url).searchParams;
  if (
    params.get("hub.mode") !== "subscribe" ||
    params.get("hub.verify_token") !== config.verifyToken
  ) {
    return jsonError("Webhook verification failed", 403);
  }

  return new NextResponse(params.get("hub.challenge") ?? "", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

/** Delivery reports (delivered / read / failed) for messages this app submitted. */
export async function POST(request: Request) {
  const config = getMetaWebhookConfig();
  if (!config) {
    return jsonError("WhatsApp webhook is not configured", 503);
  }

  const rawBody = await request.text();
  if (
    !verifyMetaWebhookSignature(
      rawBody,
      request.headers.get("x-hub-signature-256"),
      config.appSecret,
    )
  ) {
    return jsonError("Invalid webhook signature", 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonError("Invalid webhook JSON", 400);
  }

  let updated = 0;
  for (const update of extractMetaStatusUpdates(payload)) {
    try {
      if ((await applyMetaStatusUpdate(update)) === "updated") {
        updated += 1;
      }
    } catch (error) {
      // One bad update must not make Meta resend the whole batch.
      console.error("Meta WhatsApp status update failed", {
        messageId: update.messageId,
        status: update.status,
        error,
      });
    }
  }

  return NextResponse.json({ data: { updated } });
}
