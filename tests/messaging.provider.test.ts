import { describe, expect, it } from "vitest";

import { testProvider } from "@/lib/messaging/providers/test-provider";
import { ProviderSendError } from "@/lib/messaging/providers/types";
import { TEST_PROVIDER_FAIL_MOBILE_SUFFIX } from "@/lib/queue/constants";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


describe("test provider", () => {
  it("returns deterministic success", async () => {
    const result = await testProvider.send({
      channel: "SMS",
      recipient: "9876543210",
      body: "Hello",
      idempotencyKey: "key-1",
      attemptNumber: 1,
    });

    expect(result.providerMessageId).toBe("test-key-1-1");
    expect(result.status).toBe("SENT");
  });

  it("fails deterministically on first attempt for reserved mobile suffix", async () => {
    await expect(
      testProvider.send({
        channel: "SMS",
        recipient: indianProviderFailMobile(),
        body: "Hello",
        idempotencyKey: "key-fail",
        attemptNumber: 1,
      }),
    ).rejects.toBeInstanceOf(ProviderSendError);
  });

  it("succeeds on retry for reserved mobile suffix", async () => {
    const result = await testProvider.send({
      channel: "SMS",
      recipient: indianProviderFailMobile(),
      body: "Hello",
      idempotencyKey: "key-fail",
      attemptNumber: 2,
    });

    expect(result.status).toBe("SENT");
  });

  it("returns deterministic WhatsApp TEST success with synthetic provider message ID", async () => {
    const result = await testProvider.send({
      channel: "WHATSAPP",
      recipient: "9876543210",
      templateName: "hello_template",
      language: "en",
      parameterValues: ["Alex"],
      renderedBody: "Hello Alex",
      idempotencyKey: "wa-key-1",
      attemptNumber: 1,
    });

    expect(result.providerMessageId).toBe("test-wa-wa-key-1-1");
    expect(result.status).toBe("SENT");
  });
});
