import { ChannelProvider } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  buildCustomWhatsAppSendUrl,
  createCustomHttpWhatsAppProvider,
} from "@/lib/messaging/providers/whatsapp/custom-http-whatsapp-provider";
import { formatIndianWhatsAppRecipient } from "@/lib/messaging/providers/whatsapp/format-recipient";
import { parseCustomWhatsAppSendResponse } from "@/lib/messaging/providers/whatsapp/parse-response";
import { ProviderSendError } from "@/lib/messaging/providers/types";

describe("custom WhatsApp HTTP helpers", () => {
  it("formats Indian recipients like the CustomAPI expects", () => {
    expect(formatIndianWhatsAppRecipient("9876543210")).toBe("919876543210");
    expect(formatIndianWhatsAppRecipient("+919876543210")).toBe("919876543210");
    expect(() => formatIndianWhatsAppRecipient("14155550123")).toThrow(
      ProviderSendError,
    );
  });

  it("builds the send URL from configured baseUrl and sendPath", () => {
    expect(
      buildCustomWhatsAppSendUrl({
        baseUrl: "https://provider.example",
        sendPath: "/api/CustomAPI/CustomAPI_SendWhatsApp",
      }),
    ).toBe(
      "https://provider.example/api/CustomAPI/CustomAPI_SendWhatsApp",
    );
  });

  it("parses Meta-like accepted responses", () => {
    const parsed = parseCustomWhatsAppSendResponse(
      JSON.stringify({
        messaging_product: "whatsapp",
        contacts: [{ input: "919876543210", wa_id: "919876543210" }],
        messages: [
          {
            id: "wamid.ABC123",
            message_status: "accepted",
          },
        ],
        error: null,
      }),
    );

    expect(parsed.providerMessageId).toBe("wamid.ABC123");
    expect(parsed.messageStatus).toBe("accepted");
  });

  it("rejects provider error payloads", () => {
    expect(() =>
      parseCustomWhatsAppSendResponse(
        JSON.stringify({
          messages: [],
          error: { message: "template not found" },
        }),
      ),
    ).toThrow(/template not found/i);
  });
});

describe("createCustomHttpWhatsAppProvider", () => {
  it("posts multipart fields and returns the provider message id", async () => {
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      const form = init?.body as FormData;
      expect(form.get("username")).toBe("wa-user");
      expect(form.get("MobileNumber")).toBe("919876543210");
      expect(form.get("TemplateName")).toBe("services");
      expect(form.get("language")).toBe("en");
      expect(form.get("file")).toBeTruthy();
      expect(form.get("param_v1")).toBe("Alice");
      expect(form.get("apikey_wp")).toBeNull();

      return new Response(
        JSON.stringify({
          messaging_product: "whatsapp",
          messages: [{ id: "wamid.TEST", message_status: "accepted" }],
          error: null,
        }),
        { status: 200 },
      );
    });

    const provider = createCustomHttpWhatsAppProvider({
      baseUrl: "https://provider.example",
      sendPath: "/api/CustomAPI/CustomAPI_SendWhatsApp",
      username: "wa-user",
      password: "",
      requestTimeoutMs: 5_000,
      tlsInsecure: true,
      fetchFn: fetchFn as unknown as typeof fetch,
      mediaBytes: Buffer.from("fake-jpeg"),
    });

    expect(provider.name).toBe(ChannelProvider.CUSTOM_HTTP);

    const result = await provider.send({
      channel: "WHATSAPP",
      recipient: "+919876543210",
      templateName: "services",
      language: "en",
      parameterValues: ["Alice"],
      renderedBody: "Hello Alice",
      idempotencyKey: "wa-1",
      attemptNumber: 1,
    });

    expect(result).toEqual({
      providerMessageId: "wamid.TEST",
      status: "SENT",
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("maps HTTP 4xx responses to permanent-style provider errors", async () => {
    const provider = createCustomHttpWhatsAppProvider({
      baseUrl: "https://provider.example",
      sendPath: "/api/CustomAPI/CustomAPI_SendWhatsApp",
      username: "wa-user",
      password: "",
      requestTimeoutMs: 5_000,
      tlsInsecure: true,
      fetchFn: (async () =>
        new Response("Object reference not set to an instance of an object.", {
          status: 400,
        })) as unknown as typeof fetch,
      mediaBytes: Buffer.from("fake-jpeg"),
    });

    await expect(
      provider.send({
        channel: "WHATSAPP",
        recipient: "+919876543210",
        templateName: "services",
        language: "en",
        parameterValues: [],
        renderedBody: "Hello",
        idempotencyKey: "wa-2",
        attemptNumber: 1,
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_HTTP_4XX",
    });
  });

  it("sends apikey_wp instead of username/password when an API key is configured", async () => {
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const form = init?.body as FormData;
      expect(form.get("apikey_wp")).toBe("secret-key-123");
      expect(form.get("username")).toBeNull();
      expect(form.get("password")).toBeNull();
      expect(form.get("MobileNumber")).toBe("919195743709");
      expect(form.get("TemplateName")).toBe("birthday");
      expect(form.get("language")).toBe("en");
      expect(form.get("param_v1")).toBe("Sagar");

      return new Response(
        JSON.stringify({
          messages: [{ id: "wamid.APIKEY", message_status: "accepted" }],
          error: null,
        }),
        { status: 200 },
      );
    });

    const provider = createCustomHttpWhatsAppProvider({
      baseUrl: "https://45.114.141.55",
      sendPath: "/api/sendwb",
      apiKey: "secret-key-123",
      password: "",
      requestTimeoutMs: 5_000,
      tlsInsecure: true,
      fetchFn: fetchFn as unknown as typeof fetch,
      mediaBytes: Buffer.from("%PDF-1.4 fake"),
      mediaFilename: "birthday-generated.pdf",
      mediaContentType: "application/pdf",
    });

    const result = await provider.send({
      channel: "WHATSAPP",
      recipient: "9195743709",
      templateName: "birthday",
      language: "en",
      parameterValues: ["Sagar"],
      renderedBody: "Happy Birthday Sagar!",
      idempotencyKey: "wa-apikey-1",
      attemptNumber: 1,
    });

    expect(result.providerMessageId).toBe("wamid.APIKEY");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("sends the personalized PDF bytes as the file field with the correct filename/content-type", async () => {
    const pdfBytes = Buffer.from("%PDF-1.4 personalized document bytes");

    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const form = init?.body as FormData;
      const file = form.get("file") as File;
      expect(file.name).toBe("birthday-generated.pdf");
      expect(file.type).toBe("application/pdf");
      const uploaded = Buffer.from(await file.arrayBuffer());
      expect(uploaded.equals(pdfBytes)).toBe(true);

      return new Response(
        JSON.stringify({
          messages: [{ id: "wamid.PDF", message_status: "accepted" }],
          error: null,
        }),
        { status: 200 },
      );
    });

    const provider = createCustomHttpWhatsAppProvider({
      baseUrl: "https://45.114.141.55",
      sendPath: "/api/sendwb",
      apiKey: "secret-key-123",
      password: "",
      requestTimeoutMs: 5_000,
      tlsInsecure: true,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await provider.send({
      channel: "WHATSAPP",
      recipient: "9195743709",
      templateName: "birthday",
      language: "en",
      parameterValues: ["Sagar"],
      renderedBody: "Happy Birthday Sagar!",
      idempotencyKey: "wa-pdf-1",
      attemptNumber: 1,
      media: {
        bytes: pdfBytes,
        filename: "birthday-generated.pdf",
        contentType: "application/pdf",
      },
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("maps each parameterValues entry to param_v1, param_v2, ... in order", async () => {
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const form = init?.body as FormData;
      expect(form.get("param_v1")).toBe("Sagar");
      expect(form.get("param_v2")).toBe("9195743709");
      expect(form.get("param_v3")).toBeNull();

      return new Response(
        JSON.stringify({
          messages: [{ id: "wamid.MULTI", message_status: "accepted" }],
          error: null,
        }),
        { status: 200 },
      );
    });

    const provider = createCustomHttpWhatsAppProvider({
      baseUrl: "https://provider.example",
      sendPath: "/api/CustomAPI/CustomAPI_SendWhatsApp",
      username: "wa-user",
      password: "",
      requestTimeoutMs: 5_000,
      tlsInsecure: true,
      fetchFn: fetchFn as unknown as typeof fetch,
      mediaBytes: Buffer.from("fake-jpeg"),
    });

    await provider.send({
      channel: "WHATSAPP",
      recipient: "9195743709",
      templateName: "services",
      language: "en",
      parameterValues: ["Sagar", "9195743709"],
      renderedBody: "Hi",
      idempotencyKey: "wa-multi-1",
      attemptNumber: 1,
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("sends no param_v fields when there are no template parameters", async () => {
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const form = init?.body as FormData;
      expect(form.get("param_v1")).toBeNull();

      return new Response(
        JSON.stringify({
          messages: [{ id: "wamid.NOPARAM", message_status: "accepted" }],
          error: null,
        }),
        { status: 200 },
      );
    });

    const provider = createCustomHttpWhatsAppProvider({
      baseUrl: "https://provider.example",
      sendPath: "/api/CustomAPI/CustomAPI_SendWhatsApp",
      username: "wa-user",
      password: "",
      requestTimeoutMs: 5_000,
      tlsInsecure: true,
      fetchFn: fetchFn as unknown as typeof fetch,
      mediaBytes: Buffer.from("fake-jpeg"),
    });

    await provider.send({
      channel: "WHATSAPP",
      recipient: "9195743709",
      templateName: "services",
      language: "en",
      parameterValues: [],
      renderedBody: "Hi",
      idempotencyKey: "wa-noparam-1",
      attemptNumber: 1,
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("rejects SMS send requests", async () => {
    const provider = createCustomHttpWhatsAppProvider({
      baseUrl: "https://provider.example",
      sendPath: "/api/CustomAPI/CustomAPI_SendWhatsApp",
      username: "wa-user",
      password: "",
      requestTimeoutMs: 5_000,
      tlsInsecure: true,
      mediaBytes: Buffer.from("fake-jpeg"),
    });

    await expect(
      provider.send({
        channel: "SMS",
        recipient: "+919876543210",
        body: "hi",
        idempotencyKey: "sms-1",
        attemptNumber: 1,
      }),
    ).rejects.toMatchObject({ code: "INVALID_BODY" });
  });
});
