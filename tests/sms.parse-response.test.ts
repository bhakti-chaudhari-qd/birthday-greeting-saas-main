import { describe, expect, it } from "vitest";

import {
  mapLegacySmsStatusToError,
  parseLegacySmsBalanceResponse,
  parseLegacySmsResponse,
} from "@/lib/messaging/providers/sms/parse-response";

describe("parseLegacySmsResponse", () => {
  it("parses success responses", () => {
    expect(parseLegacySmsResponse("1|1|123456789")).toEqual({
      success: true,
      units: 1,
      providerMessageId: "123456789",
    });
    expect(parseLegacySmsResponse("1|2|abc123")).toEqual({
      success: true,
      units: 2,
      providerMessageId: "abc123",
    });
    expect(parseLegacySmsResponse(" 1 | 1 | 123456789 ")).toEqual({
      success: true,
      units: 1,
      providerMessageId: "123456789",
    });
  });

  it("parses documented failure status codes", () => {
    expect(parseLegacySmsResponse("2")).toEqual({
      success: false,
      statusCode: 2,
    });
    expect(parseLegacySmsResponse("2|")).toEqual({
      success: false,
      statusCode: 2,
    });
    expect(parseLegacySmsResponse("3")).toEqual({
      success: false,
      statusCode: 3,
    });
    expect(parseLegacySmsResponse("4")).toEqual({
      success: false,
      statusCode: 4,
    });
    expect(parseLegacySmsResponse("5")).toEqual({
      success: false,
      statusCode: 5,
    });
    expect(parseLegacySmsResponse("6")).toEqual({
      success: false,
      statusCode: 6,
    });
    expect(parseLegacySmsResponse("7")).toEqual({
      success: false,
      statusCode: 7,
    });
    expect(parseLegacySmsResponse("10")).toEqual({
      success: false,
      statusCode: 10,
    });
  });

  it("rejects malformed and ambiguous responses", () => {
    expect(parseLegacySmsResponse("")).toEqual({
      success: false,
      statusCode: -1,
    });
    expect(parseLegacySmsResponse("   ")).toEqual({
      success: false,
      statusCode: -1,
    });
    expect(parseLegacySmsResponse("not-a-status")).toEqual({
      success: false,
      statusCode: -1,
    });
    expect(parseLegacySmsResponse("99")).toEqual({
      success: false,
      statusCode: 99,
    });
    expect(parseLegacySmsResponse("1|1|")).toEqual({
      success: false,
      statusCode: -1,
    });
    expect(parseLegacySmsResponse("1|not-a-number|123")).toEqual({
      success: false,
      statusCode: -1,
    });
  });
});

describe("parseLegacySmsBalanceResponse", () => {
  it("treats status code 1 as valid credentials", () => {
    expect(parseLegacySmsBalanceResponse("1|100")).toEqual({
      valid: true,
      invalidCredentials: false,
      statusCode: 1,
      balanceCredits: 100,
    });
  });

  it("parses route:credits balance payloads from the live gateway", () => {
    expect(parseLegacySmsBalanceResponse("1|trans1:5065")).toEqual({
      valid: true,
      invalidCredentials: false,
      statusCode: 1,
      balanceCredits: 5065,
    });
    expect(
      parseLegacySmsBalanceResponse("1|promo:10|trans1:5065", {
        preferredRoute: "trans1",
      }),
    ).toEqual({
      valid: true,
      invalidCredentials: false,
      statusCode: 1,
      balanceCredits: 5065,
    });
    expect(parseLegacySmsBalanceResponse("1|trans1:100.9")).toEqual({
      valid: true,
      invalidCredentials: false,
      statusCode: 1,
      balanceCredits: 100,
    });
  });

  it("accepts valid credentials without a balance field", () => {
    expect(parseLegacySmsBalanceResponse("1")).toEqual({
      valid: true,
      invalidCredentials: false,
      statusCode: 1,
    });
  });

  it("treats status code 2 as invalid credentials", () => {
    expect(parseLegacySmsBalanceResponse("2|0")).toEqual({
      valid: false,
      invalidCredentials: true,
      statusCode: 2,
    });
  });

  it("rejects malformed balance responses", () => {
    expect(parseLegacySmsBalanceResponse("")).toEqual({
      valid: false,
      invalidCredentials: false,
      statusCode: -1,
    });
    expect(parseLegacySmsBalanceResponse("not-a-status")).toEqual({
      valid: false,
      invalidCredentials: false,
      statusCode: -1,
    });
  });
});

describe("mapLegacySmsStatusToError", () => {
  it("maps documented provider statuses to safe errors", () => {
    expect(mapLegacySmsStatusToError(2)).toEqual({
      code: "INVALID_CREDENTIALS",
      message: "Invalid SMS provider credentials",
    });
    expect(mapLegacySmsStatusToError(3)).toEqual({
      code: "INSUFFICIENT_BALANCE",
      message: "Insufficient SMS provider balance",
    });
    expect(mapLegacySmsStatusToError(10)).toEqual({
      code: "MISSING_TEMPLATE_ID",
      message: "SMS DLT template ID is missing",
    });
    expect(mapLegacySmsStatusToError(42)).toEqual({
      code: "PROVIDER_ERROR",
      message: "Unknown SMS provider response",
    });
  });
});
