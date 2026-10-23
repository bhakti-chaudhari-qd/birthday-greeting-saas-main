import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { assertPublicHttpTarget, guardedFetch } from "@/lib/messaging/providers/ssrf-guard";

// guardedFetch's redirect handling runs regardless of NODE_ENV - only the
// DNS-resolution check inside assertPublicHttpTarget is production-gated -
// so these run in the default test environment with no real network calls.
describe("guardedFetch", () => {
  it("passes a non-redirect response straight through, with redirects disabled on the request", async () => {
    const response = new Response("ok", { status: 200 });
    const fetchFn = vi.fn().mockResolvedValue(response);

    await expect(
      guardedFetch(fetchFn, "https://gateway.example/send", { method: "POST" }),
    ).resolves.toBe(response);

    expect(fetchFn).toHaveBeenCalledWith(
      "https://gateway.example/send",
      expect.objectContaining({ method: "POST", redirect: "manual" }),
    );
  });

  it("rejects a 302 redirect instead of letting fetch follow it to an internal target", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "http://169.254.169.254/latest/meta-data/" },
      }),
    );

    await expect(
      guardedFetch(fetchFn, "https://gateway.example/send", { method: "POST" }),
    ).rejects.toMatchObject({ code: "SSRF_BLOCKED_TARGET" });
  });

  it("rejects every 3xx status, not just 302", async () => {
    for (const status of [300, 301, 303, 307, 308]) {
      const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status }));

      await expect(
        guardedFetch(fetchFn, "https://gateway.example/send", { method: "POST" }),
      ).rejects.toMatchObject({ code: "SSRF_BLOCKED_TARGET" });
    }
  });
});

// assertPublicHttpTarget skips its DNS lookup for literal IP targets, so
// these exercise the blocklist directly with no real network calls -
// production-only, so NODE_ENV has to be stubbed.
describe("assertPublicHttpTarget blocklist", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("blocks the IPv6 unspecified address", async () => {
    await expect(assertPublicHttpTarget("http://[::]/x")).rejects.toMatchObject({
      code: "SSRF_BLOCKED_TARGET",
    });
  });

  it("blocks the shared/CGNAT range 100.64.0.0/10 (covers some cloud metadata services)", async () => {
    await expect(
      assertPublicHttpTarget("http://100.100.100.200/x"),
    ).rejects.toMatchObject({ code: "SSRF_BLOCKED_TARGET" });
  });

  it("still allows a public IPv4 literal", async () => {
    await expect(assertPublicHttpTarget("http://8.8.8.8/x")).resolves.toBeUndefined();
  });
});
