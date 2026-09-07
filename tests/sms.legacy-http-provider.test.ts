import { describe, expect, it, vi } from "vitest";

import {
  buildLegacySmsSendUrl,
  createLegacyHttpSmsProvider,
} from "@/lib/messaging/providers/sms/legacy-http-sms-provider";

const baseConfig = {
  baseUrl: "https://sms-provider.example",
  sendPath: "/send.aspx",
  username: "sms-user",
  password: "sms-pass",
  route: "trans1",
  senderId: "SENDERID",
  requestTimeoutMs: 100,
  successStatusCode: 1,
};

describe("legacy HTTP SMS provider", () => {
  it("builds a request URL from configured baseUrl and sendPath", () => {
    const url = new URL(
      buildLegacySmsSendUrl(baseConfig, {
        numbers: "919876543210",
        message: "Hello & welcome!",
        templateId: "DLT123",
      }),
    );

    expect(url.origin).toBe("https://sms-provider.example");
    expect(url.pathname).toBe("/send.aspx");
    expect(url.searchParams.get("username")).toBe("sms-user");
    expect(url.searchParams.get("pass")).toBe("sms-pass");
    expect(url.searchParams.get("route")).toBe("trans1");
    expect(url.searchParams.get("senderid")).toBe("SENDERID");
    expect(url.searchParams.get("numbers")).toBe("919876543210");
    expect(url.searchParams.get("message")).toBe("Hello & welcome!");
    expect(url.searchParams.get("templateid")).toBe("DLT123");
  });

  it("uses a custom sendPath when configured", () => {
    const url = new URL(
      buildLegacySmsSendUrl(
        { ...baseConfig, sendPath: "/api/sms/send" },
        {
          numbers: "919876543210",
          message: "Hello",
          templateId: "DLT123",
        },
      ),
    );

    expect(url.pathname).toBe("/api/sms/send");
  });

  it("returns provider message ID on success", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "1|1|123456789",
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const provider = createLegacyHttpSmsProvider({
      ...baseConfig,
      fetchFn: fetchFn as typeof fetch,
    });

    const result = await provider.send({
      channel: "SMS",
      recipient: "+919876543210",
      body: "Happy Birthday Alice!",
      idempotencyKey: "key-1",
      attemptNumber: 1,
      dltTemplateId: "DLT123",
    });

    expect(result).toEqual({
      providerMessageId: "123456789",
      status: "SENT",
      units: 1,
    });

    const requestedUrl = String(fetchFn.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("templateid=DLT123");
    expect(requestedUrl).toContain("numbers=919876543210");
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("sms-pass"),
    );

    consoleSpy.mockRestore();
  });

  it("maps provider rejection to safe errors", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "3",
    });

    const provider = createLegacyHttpSmsProvider({
      ...baseConfig,
      fetchFn: fetchFn as typeof fetch,
    });

    await expect(
      provider.send({
        channel: "SMS",
        recipient: "+919876543210",
        body: "Hello",
        idempotencyKey: "key-1",
        attemptNumber: 1,
        dltTemplateId: "DLT123",
      }),
    ).rejects.toMatchObject({
      code: "INSUFFICIENT_BALANCE",
      message: "Insufficient SMS provider balance",
    });
  });

  it("requires DLT template ID", async () => {
    const provider = createLegacyHttpSmsProvider(baseConfig);

    await expect(
      provider.send({
        channel: "SMS",
        recipient: "+919876543210",
        body: "Hello",
        idempotencyKey: "key-1",
        attemptNumber: 1,
        dltTemplateId: null,
      }),
    ).rejects.toMatchObject({
      code: "MISSING_TEMPLATE_ID",
    });
  });

  it("handles network failures and non-2xx responses", async () => {
    const networkProvider = createLegacyHttpSmsProvider({
      ...baseConfig,
      fetchFn: vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch,
    });
    await expect(
      networkProvider.send({
        channel: "SMS",
        recipient: "+919876543210",
        body: "Hello",
        idempotencyKey: "key-1",
        attemptNumber: 1,
        dltTemplateId: "DLT123",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_NETWORK_ERROR" });

    const httpErrorProvider = createLegacyHttpSmsProvider({
      ...baseConfig,
      fetchFn: vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "error",
      }) as typeof fetch,
    });
    await expect(
      httpErrorProvider.send({
        channel: "SMS",
        recipient: "+919876543210",
        body: "Hello",
        idempotencyKey: "key-1",
        attemptNumber: 1,
        dltTemplateId: "DLT123",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_HTTP_5XX" });

    const http4xxProvider = createLegacyHttpSmsProvider({
      ...baseConfig,
      fetchFn: vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "unauthorized",
      }) as typeof fetch,
    });
    await expect(
      http4xxProvider.send({
        channel: "SMS",
        recipient: "+919876543210",
        body: "Hello",
        idempotencyKey: "key-1",
        attemptNumber: 1,
        dltTemplateId: "DLT123",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_HTTP_4XX" });

    const http429Provider = createLegacyHttpSmsProvider({
      ...baseConfig,
      fetchFn: vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "rate limited",
      }) as typeof fetch,
    });
    await expect(
      http429Provider.send({
        channel: "SMS",
        recipient: "+919876543210",
        body: "Hello",
        idempotencyKey: "key-1",
        attemptNumber: 1,
        dltTemplateId: "DLT123",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_HTTP_429" });
  });

  it("handles request timeouts", async () => {
    vi.useFakeTimers();

    try {
      const fetchFn = vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            if (init?.signal?.aborted) {
              reject(
                new DOMException("The operation was aborted.", "AbortError"),
              );
              return;
            }

            init?.signal?.addEventListener("abort", () => {
              reject(
                new DOMException("The operation was aborted.", "AbortError"),
              );
            });
          }),
      );

      const timeoutProvider = createLegacyHttpSmsProvider({
        ...baseConfig,
        requestTimeoutMs: 50,
        fetchFn: fetchFn as typeof fetch,
      });

      const sendPromise = timeoutProvider.send({
        channel: "SMS",
        recipient: "+919876543210",
        body: "Hello",
        idempotencyKey: "key-1",
        attemptNumber: 1,
        dltTemplateId: "DLT123",
      });

      const resultPromise = sendPromise.catch((error: unknown) => error);

      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(60);

      const error = await resultPromise;
      expect(error).toMatchObject({ code: "PROVIDER_TIMEOUT" });
    } finally {
      vi.useRealTimers();
    }
  });
});
