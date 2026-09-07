import { describe, expect, it } from "vitest";

import { parseAllowedDevOrigins } from "@/lib/dev/parse-allowed-dev-origins";

describe("parseAllowedDevOrigins", () => {
  it("returns an empty list for undefined or blank input", () => {
    expect(parseAllowedDevOrigins(undefined)).toEqual([]);
    expect(parseAllowedDevOrigins("")).toEqual([]);
    expect(parseAllowedDevOrigins("   ")).toEqual([]);
  });

  it("parses a single host", () => {
    expect(parseAllowedDevOrigins("192.168.1.100")).toEqual(["192.168.1.100"]);
  });

  it("parses comma-separated hosts, trims whitespace, and drops empty entries", () => {
    expect(
      parseAllowedDevOrigins(" 192.168.1.100 , 10.0.0.5,, *.example.test "),
    ).toEqual(["192.168.1.100", "10.0.0.5", "*.example.test"]);
  });
});
