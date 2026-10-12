import { describe, expect, it } from "vitest";

import { categoryAutomationRuleInputSchema } from "@/lib/validation/category-automation";

const baseRule = {
  categoryId: "cat_1",
  sendHour: 10,
  sendMinute: 0,
  smsEnabled: false,
  smsTemplateId: null,
  whatsappEnabled: false,
  whatsappTemplateId: null,
};

function firstMessage(input: unknown): string | null {
  const result = categoryAutomationRuleInputSchema.safeParse(input);
  return result.success ? null : (result.error.issues[0]?.message ?? "");
}

describe("category automation call rule validation", () => {
  it("accepts a call rule with a recording inside calling hours", () => {
    const result = categoryAutomationRuleInputSchema.safeParse({
      ...baseRule,
      callEnabled: true,
      callTemplateId: "tpl_call",
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.callTemplateId).toBe("tpl_call");
  });

  it("requires a recording when Call is enabled", () => {
    expect(firstMessage({ ...baseRule, callEnabled: true })).toBe(
      "Call recording is required when Call is enabled",
    );
  });

  it("rejects call send times outside 9 AM to 9 PM", () => {
    for (const sendHour of [8, 21, 23]) {
      expect(
        firstMessage({
          ...baseRule,
          sendHour,
          callEnabled: true,
          callTemplateId: "tpl_call",
        }),
      ).toMatch(/between 9 AM and 9 PM/);
    }

    for (const sendHour of [9, 20]) {
      expect(
        firstMessage({
          ...baseRule,
          sendHour,
          callEnabled: true,
          callTemplateId: "tpl_call",
        }),
      ).toBeNull();
    }
  });

  it("leaves other channels free to send outside calling hours", () => {
    expect(
      firstMessage({
        ...baseRule,
        sendHour: 6,
        smsEnabled: true,
        smsTemplateId: "tpl_sms",
      }),
    ).toBeNull();
  });
});
