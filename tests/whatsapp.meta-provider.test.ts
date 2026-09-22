import { describe, expect, it, vi } from "vitest";

import { createMetaWhatsAppProvider } from "@/lib/messaging/providers/whatsapp/meta-whatsapp-provider";
import { ProviderSendError } from "@/lib/messaging/providers/types";

const baseConfig = {
  accessToken: "test-token",
  phoneNumberId: "1320947411098948",
  apiVersion: "v21.0",
  requestTimeoutMs: 5_000,
};

describe("createMetaWhatsAppProvider", () => {
  it("posts a JSON template send with body parameters and returns the message id", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe(
        "https://graph.facebook.com/v21.0/1320947411098948/messages",
      );
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>).Authorization).toBe(
        "Bearer test-token",
      );
      const body = JSON.parse(init?.body as string);
      expect(body.messaging_product).toBe("whatsapp");
      expect(body.to).toBe("919876543210");
      expect(body.type).toBe("template");
      expect(body.template.name).toBe("services");
      expect(body.template.language).toEqual({ code: "en_US" });
      expect(body.template.components).toEqual([
        {
          type: "body",
          parameters: [{ type: "text", text: "Alice" }],
        },
      ]);

      return new Response(
        JSON.stringify({
          messaging_product: "whatsapp",
          contacts: [{ input: "919876543210", wa_id: "919876543210" }],
          messages: [{ id: "wamid.META123" }],
        }),
        { status: 200 },
      );
    });

    const provider = createMetaWhatsAppProvider({ ...baseConfig, fetchFn });

    const result = await provider.send({
      channel: "WHATSAPP",
      recipient: "9876543210",
      templateName: "services",
      language: "en_US",
      parameterValues: ["Alice"],
      renderedBody: "Hi Alice",
      idempotencyKey: "idem-1",
      attemptNumber: 1,
    });

    expect(result.providerMessageId).toBe("wamid.META123");
    expect(result.status).toBe("SENT");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("uploads media first and attaches it as a template header parameter", async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(url);

      if (url.endsWith("/media")) {
        const form = init?.body as FormData;
        expect(form.get("messaging_product")).toBe("whatsapp");
        expect(form.get("type")).toBe("image/jpeg");
        expect(form.get("file")).toBeTruthy();
        return new Response(JSON.stringify({ id: "media-id-123" }), {
          status: 200,
        });
      }

      const body = JSON.parse(init?.body as string);
      expect(body.template.components).toEqual([
        {
          type: "header",
          parameters: [{ type: "image", image: { id: "media-id-123" } }],
        },
        {
          type: "body",
          parameters: [{ type: "text", text: "Alice" }],
        },
      ]);

      return new Response(
        JSON.stringify({ messages: [{ id: "wamid.META456" }] }),
        { status: 200 },
      );
    });

    const provider = createMetaWhatsAppProvider({ ...baseConfig, fetchFn });

    const result = await provider.send({
      channel: "WHATSAPP",
      recipient: "9876543210",
      templateName: "birthday_card",
      language: "en_US",
      parameterValues: ["Alice"],
      renderedBody: "Hi Alice",
      media: {
        bytes: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
        filename: "card.jpg",
        contentType: "image/jpeg",
      },
      idempotencyKey: "idem-2",
      attemptNumber: 1,
    });

    expect(calls).toEqual([
      "https://graph.facebook.com/v21.0/1320947411098948/media",
      "https://graph.facebook.com/v21.0/1320947411098948/messages",
    ]);
    expect(result.providerMessageId).toBe("wamid.META456");
  });

  it("rejects WebM media - Meta Cloud API does not support it", async () => {
    const fetchFn = vi.fn();
    const provider = createMetaWhatsAppProvider({ ...baseConfig, fetchFn });

    await expect(
      provider.send({
        channel: "WHATSAPP",
        recipient: "9876543210",
        templateName: "birthday_card",
        language: "en_US",
        parameterValues: [],
        renderedBody: "Hi",
        media: {
          bytes: Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
          filename: "card.webm",
          contentType: "video/webm",
        },
        idempotencyKey: "idem-3",
        attemptNumber: 1,
      }),
    ).rejects.toThrow(ProviderSendError);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("surfaces Meta's error message on a 4xx response", async () => {
    const fetchFn = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: { message: "(#132001) Template name does not exist" },
        }),
        { status: 400 },
      ),
    );
    const provider = createMetaWhatsAppProvider({ ...baseConfig, fetchFn });

    await expect(
      provider.send({
        channel: "WHATSAPP",
        recipient: "9876543210",
        templateName: "missing_template",
        language: "en_US",
        parameterValues: [],
        renderedBody: "Hi",
        idempotencyKey: "idem-4",
        attemptNumber: 1,
      }),
    ).rejects.toThrow(/Template name does not exist/);
  });

  it("throws PROVIDER_HTTP_429 on rate limiting", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 429 }));
    const provider = createMetaWhatsAppProvider({ ...baseConfig, fetchFn });

    await expect(
      provider.send({
        channel: "WHATSAPP",
        recipient: "9876543210",
        templateName: "services",
        language: "en_US",
        parameterValues: [],
        renderedBody: "Hi",
        idempotencyKey: "idem-5",
        attemptNumber: 1,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_HTTP_429" });
  });
});
