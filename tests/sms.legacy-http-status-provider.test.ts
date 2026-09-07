import { describe, expect, it, vi } from "vitest";

import {
  buildLegacySmsStatusUrl,
  createLegacyHttpSmsProvider,
} from "@/lib/messaging/providers/sms/legacy-http-sms-provider";
import { DeliveryStatusLookupError } from "@/lib/messaging/providers/types";

const config = {
  baseUrl: "http://example.test",
  sendPath: "/send.aspx",
  username: "sms-user",
  password: "sms-pass",
  route: "trans1",
  senderId: "SENDERID",
  requestTimeoutMs: 1_000,
  successStatusCode: 1,
};

describe("legacy HTTP SMS delivery status provider", () => {
  it("builds a status URL with msgid and date parameters", () => {
    const url = new URL(
      buildLegacySmsStatusUrl(config, {
        msgid: "provider-123",
        date: "2026-07-11",
      }),
    );

    expect(url.pathname).toBe("/status.aspx");
    expect(url.searchParams.get("msgid")).toBe("provider-123");
    expect(url.searchParams.get("date")).toBe("2026-07-11");
    expect(url.searchParams.get("username")).toBe("sms-user");
    expect(url.searchParams.get("pass")).toBe("sms-pass");
  });

  it("returns delivered outcome for a matching DELIVRD record", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          Status: true,
          Message: "Success",
          Response: [{ Mobile: "919876543210", DeliveryStatus: "DELIVRD" }],
        }),
    });

    const provider = createLegacyHttpSmsProvider({
      ...config,
      fetchFn: fetchImpl as typeof fetch,
    });

    const result = await provider.getDeliveryStatus({
      providerMessageId: "provider-123",
      submissionDate: "2026-07-11",
      recipient: "+919876543210",
    });

    expect(result.outcome).toBe("delivered");
    expect(result.rawProviderStatus).toBe("DELIVRD");

    const requestedUrl = String(fetchImpl.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("msgid=provider-123");
    expect(requestedUrl).toContain("date=2026-07-11");
    expect(requestedUrl).toContain("pass=");
  });

  it("rejects non-2xx responses", async () => {
    const provider = createLegacyHttpSmsProvider({
      ...config,
      fetchFn: vi.fn().mockResolvedValue({ ok: false, text: async () => "" }),
    });

    await expect(
      provider.getDeliveryStatus({
        providerMessageId: "provider-123",
        submissionDate: "2026-07-11",
        recipient: "+919876543210",
      }),
    ).rejects.toBeInstanceOf(DeliveryStatusLookupError);
  });

  it("rejects timeout failures", async () => {
    const provider = createLegacyHttpSmsProvider({
      ...config,
      fetchFn: vi.fn().mockRejectedValue(
        Object.assign(new Error("aborted"), { name: "AbortError" }),
      ),
    });

    await expect(
      provider.getDeliveryStatus({
        providerMessageId: "provider-123",
        submissionDate: "2026-07-11",
        recipient: "+919876543210",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });
  });

  it("does not log credentials when lookup fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "not-json",
    });

    const provider = createLegacyHttpSmsProvider({
      ...config,
      fetchFn: fetchImpl as typeof fetch,
    });

    await expect(
      provider.getDeliveryStatus({
        providerMessageId: "provider-123",
        submissionDate: "2026-07-11",
        recipient: "+919876543210",
      }),
    ).rejects.toBeInstanceOf(DeliveryStatusLookupError);

    for (const call of consoleSpy.mock.calls.flat()) {
      expect(String(call)).not.toContain("sms-pass");
      expect(String(call)).not.toContain("sms-user");
    }

    consoleSpy.mockRestore();
  });
});
