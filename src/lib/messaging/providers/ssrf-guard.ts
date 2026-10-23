import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { ProviderSendError } from "./types";

function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }

  const [a, b] = parts as [number, number, number, number];
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata (169.254.169.254)
  if (a === 0) return true; // "this network"
  if (a === 100 && b >= 64 && b <= 127) return true; // shared/CGNAT 100.64.0.0/10, incl. some cloud metadata (100.100.100.200)
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking 198.18.0.0/15
  if (a >= 224) return true; // multicast / reserved

  return false;
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true; // loopback
  if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true; // unspecified - some stacks route this to localhost
  if (normalized.startsWith("64:ff9b::")) return true; // NAT64 well-known prefix - can bridge to an internal IPv4 target
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local fc00::/7
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true; // link-local fe80::/10
  }
  if (normalized.startsWith("::ffff:")) {
    // IPv4-mapped IPv6 - check the embedded IPv4 address.
    const embedded = normalized.slice("::ffff:".length);
    if (isIP(embedded) === 4) {
      return isPrivateOrReservedIPv4(embedded);
    }
  }

  return false;
}

function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateOrReservedIPv4(ip);
  if (version === 6) return isPrivateOrReservedIPv6(ip);
  return true; // not a recognizable IP literal - fail closed
}

/**
 * Blocks outbound SMS/WhatsApp gateway requests whose target resolves to a
 * private/loopback/link-local/metadata address - an org admin can otherwise
 * point a Custom HTTP gateway's baseUrl at internal infrastructure (SSRF).
 * Resolves DNS rather than checking the literal hostname, since a hostname
 * can be made to resolve to a private IP (DNS rebinding).
 *
 * Production-only, matching this codebase's existing pattern for gateway
 * safety checks (see tlsInsecure's NODE_ENV guard): local/self-signed test
 * gateways on private addresses are an intentional, documented feature in
 * development, and the provider unit tests target a non-resolving
 * `.example` baseUrl with a mocked fetchFn.
 */
export async function assertPublicHttpTarget(targetUrl: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  let hostname: string;
  try {
    hostname = new URL(targetUrl).hostname;
  } catch {
    throw new ProviderSendError(
      "Invalid provider target URL",
      "SSRF_BLOCKED_TARGET",
    );
  }

  const literalIpVersion = isIP(hostname);
  if (literalIpVersion) {
    if (isBlockedIp(hostname)) {
      throw new ProviderSendError(
        "Provider target resolves to a private or reserved address",
        "SSRF_BLOCKED_TARGET",
      );
    }
    return;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ProviderSendError(
      "Provider target hostname could not be resolved",
      "SSRF_BLOCKED_TARGET",
    );
  }

  if (
    addresses.length === 0 ||
    addresses.some((entry) => isBlockedIp(entry.address))
  ) {
    throw new ProviderSendError(
      "Provider target resolves to a private or reserved address",
      "SSRF_BLOCKED_TARGET",
    );
  }
}

/**
 * Validates the target the same way as assertPublicHttpTarget, then performs
 * the request with redirects disabled. A redirect response is treated as
 * blocked rather than followed: assertPublicHttpTarget only vets the first
 * URL, so a gateway that is reachable and passes the check could otherwise
 * 30x the request to an internal address (fetch follows redirects by
 * default) and bypass the guard entirely on the second hop.
 */
export async function guardedFetch(
  fetchFn: typeof fetch,
  targetUrl: string,
  init: RequestInit,
): Promise<Response> {
  await assertPublicHttpTarget(targetUrl);

  const response = await fetchFn(targetUrl, { ...init, redirect: "manual" });

  if (response.status >= 300 && response.status < 400) {
    throw new ProviderSendError(
      "Provider target returned a redirect, which is not followed",
      "SSRF_BLOCKED_TARGET",
    );
  }

  return response;
}
