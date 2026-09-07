import { describe, expect, it, vi } from "vitest";

import {
  buildLegacySmsBalanceUrl,
  verifyLegacyHttpSmsConfiguration,
} from "@/lib/messaging/providers/sms/legacy-http-sms-provider";
import { ProviderSendError } from "@/lib/messaging/providers/types";

import type { ResolvedSmsProviderConfig } from "@/lib/channel-config/types";

import { buildSmsChannelConfigInput } from "./sms-test-helpers";

const built = buildSmsChannelConfigInput();
const config: ResolvedSmsProviderConfig = {
  baseUrl: built.settings.baseUrl,
  sendPath: built.settings.sendPath,
  requestTimeoutMs: built.settings.requestTimeoutMs ?? 10_000,
  route: built.settings.route,
  senderId: built.settings.senderId,
  username: "sms-user",
  password: "sms-pass",
  successStatusCode: 1,
};

describe("legacy HTTP SMS balance verification", () => {
  it("builds balance URLs without logging credentials", () => {
    const url = new URL(buildLegacySmsBalanceUrl(config));

    expect(url.pathname).toBe("/balance.aspx");
    expect(url.searchParams.get("username")).toBe("sms-user");
    expect(url.searchParams.get("pass")).toBe("sms-pass");
  });

  it("verifies configuration using the balance endpoint", async () => {
    let capturedUrl = "";
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      capturedUrl = String(input);
      return new Response("1|100", { status: 200 });
    });

    await expect(
      verifyLegacyHttpSmsConfiguration({
        ...config,
        fetchFn,
      }),
    ).resolves.toEqual({ balanceCredits: 100 });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(capturedUrl).toContain("/balance.aspx");
    expect(capturedUrl).not.toContain("send.aspx");
  });

  it("parses live gateway route:credits balance responses", async () => {
    await expect(
      verifyLegacyHttpSmsConfiguration({
        ...config,
        route: "trans1",
        fetchFn: async () => new Response("1|trans1:5065", { status: 200 }),
      }),
    ).resolves.toEqual({ balanceCredits: 5065 });
  });

  it("maps invalid credentials to a safe provider error", async () => {
    await expect(
      verifyLegacyHttpSmsConfiguration({
        ...config,
        fetchFn: async () => new Response("2|0", { status: 200 }),
      }),
    ).rejects.toMatchObject({
      name: "ProviderSendError",
      code: "INVALID_CREDENTIALS",
    } satisfies Partial<ProviderSendError>);
  });

  it("handles provider timeouts safely", async () => {
    await expect(
      verifyLegacyHttpSmsConfiguration({
        ...config,
        requestTimeoutMs: 10,
        fetchFn: async (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const error = new Error("The operation was aborted");
              error.name = "AbortError";
              reject(error);
            });
          }),
      }),
    ).rejects.toMatchObject({
      name: "DeliveryStatusLookupError",
      code: "PROVIDER_TIMEOUT",
    });
  });
});
