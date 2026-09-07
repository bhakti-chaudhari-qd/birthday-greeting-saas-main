import { describe, expect, it } from "vitest";

import { ProviderSendError } from "@/lib/messaging/providers/types";
import {
  formatIndianSmsRecipient,
  formatIndianSmsRecipientDigits,
} from "@/lib/messaging/providers/sms/format-recipient";

describe("formatIndianSmsRecipient", () => {
  it("converts valid 10-digit numbers to 12-digit provider format", () => {
    expect(formatIndianSmsRecipient("9876543210")).toBe("919876543210");
    expect(formatIndianSmsRecipient("6123456789")).toBe("916123456789");
  });

  it("accepts legacy +91 storage for provider formatting", () => {
    expect(formatIndianSmsRecipient("+919876543210")).toBe("919876543210");
  });

  it("rejects unsupported numbers", () => {
    expect(() => formatIndianSmsRecipient("15551234567")).toThrow(
      ProviderSendError,
    );
    expect(() => formatIndianSmsRecipient("987654321")).toThrow(
      ProviderSendError,
    );
    expect(() => formatIndianSmsRecipient("5876543210")).toThrow(
      ProviderSendError,
    );
  });
});

describe("formatIndianSmsRecipientDigits", () => {
  it("matches send-adapter formatting before status lookup", () => {
    expect(formatIndianSmsRecipientDigits("9876543210")).toBe("919876543210");
  });
});
