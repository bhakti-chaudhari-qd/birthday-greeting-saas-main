import { describe, expect, it } from "vitest";

import {
  DEFAULT_TOMORROW_LIST_BUTTON_TEXT,
  DEFAULT_TOMORROW_LIST_TEMPLATE_BODY,
  buildTomorrowListTemplatePayload,
  submitTomorrowListTemplateSchema,
} from "@/lib/tomorrow-list/meta-template";

const valid = {
  whatsappBusinessAccountId: "102290129340398",
  templateName: "tomorrow_list",
  language: "en",
  body: DEFAULT_TOMORROW_LIST_TEMPLATE_BODY,
  buttonText: DEFAULT_TOMORROW_LIST_BUTTON_TEXT,
  baseUrl: "https://www.birthdaywishs.in/",
};

describe("submitTomorrowListTemplateSchema", () => {
  it("accepts the default template", () => {
    expect(submitTomorrowListTemplateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects text Meta would refuse or the sender cannot fill", () => {
    for (const body of [
      "Hello {{1}}, tomorrow {{2}} you have some people on the list.", // no {{3}}
      "Hello {{1}} {{1}}, tomorrow {{2}} there are {{3}} people.", // {{1}} twice
      "Hello {{1}}, tomorrow {{2}} there are {{3}} people, {{4}}.", // extra variable
      "{{1}}: tomorrow {{2}} there are {{3}} people on your list.", // starts with variable
      "Hello, tomorrow {{2}} there are people on your list {{1}} {{3}}", // ends with variable
    ]) {
      expect(
        submitTomorrowListTemplateSchema.safeParse({ ...valid, body }).success,
        body,
      ).toBe(false);
    }
    for (const bad of [
      { baseUrl: "http://www.birthdaywishs.in" },
      { whatsappBusinessAccountId: "abc" },
      { buttonText: "x".repeat(26) },
    ]) {
      expect(submitTomorrowListTemplateSchema.safeParse({ ...valid, ...bad }).success).toBe(
        false,
      );
    }
  });
});

describe("buildTomorrowListTemplatePayload", () => {
  it("builds a utility template with a dynamic /t/{{1}} button", () => {
    const payload = buildTomorrowListTemplatePayload(
      submitTomorrowListTemplateSchema.parse(valid),
    );
    expect(payload.category).toBe("UTILITY");
    expect(payload.components[0]).toMatchObject({
      type: "BODY",
      example: { body_text: [["Sharma Clinic", "17 Nov 2026", "5"]] },
    });
    expect(payload.components[1]).toEqual({
      type: "BUTTONS",
      buttons: [
        {
          type: "URL",
          text: "View list",
          url: "https://www.birthdaywishs.in/t/{{1}}",
          example: ["https://www.birthdaywishs.in/t/sample"],
        },
      ],
    });
  });
});
