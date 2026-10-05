import { describe, expect, it, vi } from "vitest";

import { buildWhatsAppHttpSettings } from "@/lib/channel-config/whatsapp-resolve";
import { createKoverageWhatsAppProvider } from "@/lib/messaging/providers/whatsapp/koverage-whatsapp-provider";

const baseConfig = {
  apiFormat: "KOVERAGE" as const,
  baseUrl: "https://waba.koverage.example",
  sendPath: "/api/vendor-uid-1/contact/send-message",
  apiKey: "koverage-token",
  password: "",
  requestTimeoutMs: 5_000,
  tlsInsecure: false,
};

const baseRequest = {
  channel: "WHATSAPP" as const,
  recipient: "9876543210",
  templateName: "demotem",
  language: "en",
  parameterValues: [] as string[],
  renderedBody: "Hello",
  idempotencyKey: "idem-1",
  attemptNumber: 1,
};

function mockFetch(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify(body), { status }),
  );
}

describe("createKoverageWhatsAppProvider", () => {
  it("posts a JSON template send with a bearer token and ordered fields", async () => {
    const fetchFn = mockFetch({
      result: "success",
      data: { wamid: "wamid.KOV123" },
    });
    const provider = createKoverageWhatsAppProvider({ ...baseConfig, fetchFn });

    const result = await provider.send({
      ...baseRequest,
      parameterValues: ["Alice", "Pune"],
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(
      "https://waba.koverage.example/api/vendor-uid-1/contact/send-message",
    );
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer koverage-token",
    );
    expect(JSON.parse(init?.body as string)).toEqual({
      phone_number: "919876543210",
      template_name: "demotem",
      template_language: "en",
      field_1: "Alice",
      field_2: "Pune",
    });
    expect(result).toEqual({ providerMessageId: "wamid.KOV123", status: "SENT" });
  });

  it("falls back to the idempotency key when no message id is returned", async () => {
    const fetchFn = mockFetch({ result: "success", message: "Message processed" });
    const provider = createKoverageWhatsAppProvider({ ...baseConfig, fetchFn });

    const result = await provider.send(baseRequest);

    expect(result.providerMessageId).toBe("idem-1");
  });

  it("treats a non-success result on HTTP 200 as a rejected send", async () => {
    const fetchFn = mockFetch({ result: "failed", message: "Template not found" });
    const provider = createKoverageWhatsAppProvider({ ...baseConfig, fetchFn });

    await expect(provider.send(baseRequest)).rejects.toThrow(/Template not found/);
  });

  it("surfaces the provider message on a 4xx response", async () => {
    const fetchFn = mockFetch({ message: "Invalid token" }, 401);
    const provider = createKoverageWhatsAppProvider({ ...baseConfig, fetchFn });

    await expect(provider.send(baseRequest)).rejects.toMatchObject({
      code: "PROVIDER_HTTP_4XX",
      message: expect.stringContaining("Invalid token"),
    });
  });

  it("rejects media greetings without calling the gateway", async () => {
    const fetchFn = mockFetch({ result: "success" });
    const provider = createKoverageWhatsAppProvider({ ...baseConfig, fetchFn });

    await expect(
      provider.send({
        ...baseRequest,
        media: {
          bytes: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
          filename: "card.jpg",
          contentType: "image/jpeg",
        },
      }),
    ).rejects.toThrow(/text-only/);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("buildWhatsAppHttpSettings apiFormat", () => {
  it("stores the Koverage format and omits it for the default contract", () => {
    expect(
      buildWhatsAppHttpSettings(
        "https://waba.koverage.example",
        "/api/vendor-uid-1/contact/send-message",
        null,
        false,
        "KOVERAGE",
      ).apiFormat,
    ).toBe("KOVERAGE");
    expect(
      buildWhatsAppHttpSettings("https://gateway.example", "/send"),
    ).not.toHaveProperty("apiFormat");
  });
});
