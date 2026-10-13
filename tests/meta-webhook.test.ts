import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  describeMetaDeliveryFailure,
  extractMetaStatusUpdates,
  getMetaWebhookConfig,
  verifyMetaVerifyToken,
  verifyMetaWebhookSignature,
} from "@/lib/deliveries/meta-webhook";

function statusPayload(statuses: unknown[]) {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "waba-1", changes: [{ field: "messages", value: { statuses } }] }],
  };
}

describe("verifyMetaWebhookSignature", () => {
  const secret = "app-secret";
  const body = JSON.stringify({ hello: "world" });
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  it("accepts a body signed with the app secret", () => {
    expect(verifyMetaWebhookSignature(body, signature, secret)).toBe(true);
  });

  it("rejects a tampered body, a wrong secret, and a missing or malformed header", () => {
    expect(verifyMetaWebhookSignature(`${body} `, signature, secret)).toBe(false);
    expect(verifyMetaWebhookSignature(body, signature, "other-secret")).toBe(false);
    expect(verifyMetaWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyMetaWebhookSignature(body, "sha256=zz", secret)).toBe(false);
    expect(verifyMetaWebhookSignature(body, signature.slice(7), secret)).toBe(false);
  });
});

describe("verifyMetaVerifyToken", () => {
  it("accepts the exact token and rejects everything else", () => {
    expect(verifyMetaVerifyToken("secret-token", "secret-token")).toBe(true);
    expect(verifyMetaVerifyToken("secret-toke", "secret-token")).toBe(false);
    expect(verifyMetaVerifyToken("secret-token-extra", "secret-token")).toBe(false);
    expect(verifyMetaVerifyToken("wrong", "secret-token")).toBe(false);
    expect(verifyMetaVerifyToken(null, "secret-token")).toBe(false);
    expect(verifyMetaVerifyToken("", "secret-token")).toBe(false);
  });
});

describe("getMetaWebhookConfig", () => {
  it("is off unless both the verify token and app secret are set", () => {
    expect(getMetaWebhookConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(
      getMetaWebhookConfig({
        META_WEBHOOK_VERIFY_TOKEN: "token",
      } as unknown as NodeJS.ProcessEnv),
    ).toBeNull();
    expect(
      getMetaWebhookConfig({
        META_WEBHOOK_VERIFY_TOKEN: "token",
        META_WEBHOOK_APP_SECRET: "secret",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({ verifyToken: "token", appSecret: "secret" });
  });
});

describe("extractMetaStatusUpdates", () => {
  it("reads delivered and read updates", () => {
    expect(
      extractMetaStatusUpdates(
        statusPayload([
          { id: "wamid.A", status: "delivered", recipient_id: "919800000000" },
          { id: "wamid.B", status: "read" },
        ]),
      ),
    ).toEqual([
      { messageId: "wamid.A", status: "delivered", errorCode: null, errorMessage: null },
      { messageId: "wamid.B", status: "read", errorCode: null, errorMessage: null },
    ]);
  });

  it("reads the reason from a failed update, preferring Meta's detail text", () => {
    const [update] = extractMetaStatusUpdates(
      statusPayload([
        {
          id: "wamid.C",
          status: "failed",
          errors: [
            {
              code: 131049,
              title: "This message was not delivered to maintain healthy ecosystem engagement.",
              error_data: {
                details:
                  "In order to maintain a healthy ecosystem engagement, the message failed to be delivered.",
              },
            },
          ],
        },
      ]),
    );

    expect(update).toEqual({
      messageId: "wamid.C",
      status: "failed",
      errorCode: "131049",
      errorMessage:
        "In order to maintain a healthy ecosystem engagement, the message failed to be delivered.",
    });
    expect(describeMetaDeliveryFailure(update!)).toBe(
      "WhatsApp did not deliver this message: In order to maintain a healthy ecosystem engagement, the message failed to be delivered. (Meta error 131049)",
    );
  });

  it("ignores incoming messages, unknown statuses and malformed payloads", () => {
    expect(extractMetaStatusUpdates(null)).toEqual([]);
    expect(extractMetaStatusUpdates({ entry: "nope" })).toEqual([]);
    expect(
      extractMetaStatusUpdates({
        entry: [{ changes: [{ value: { messages: [{ id: "wamid.IN", text: {} }] } }] }],
      }),
    ).toEqual([]);
    expect(
      extractMetaStatusUpdates(
        statusPayload([{ id: "wamid.D", status: "deleted" }, { status: "delivered" }]),
      ),
    ).toEqual([]);
  });
});
