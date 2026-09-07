import { describe, expect, it } from "vitest";

import {
  getMessageLengthHint,
  sanitizeSuggestedBody,
  suggestMessage,
  suggestMessageVariants,
  rewriteMessage,
} from "@/lib/ai/suggest-message";

describe("sanitizeSuggestedBody", () => {
  it("keeps a valid body with {{name}}", () => {
    const body = sanitizeSuggestedBody(
      "Happy Birthday {{name}}! Have a great day.",
      "SMS",
    );
    expect(body).toBe("Happy Birthday {{name}}! Have a great day.");
  });

  it("adds {{name}} when missing", () => {
    const body = sanitizeSuggestedBody("Happy Birthday!", "SMS");
    expect(body).toContain("{{name}}");
  });

  it("rejects unsupported variables", () => {
    const body = sanitizeSuggestedBody(
      "Hello {{name}} and {{company}}",
      "SMS",
    );
    expect(body).toBeNull();
  });

  it("strips markdown fences", () => {
    const body = sanitizeSuggestedBody(
      "```\nHappy Birthday {{name}}!\n```",
      "SMS",
    );
    expect(body).toBe("Happy Birthday {{name}}!");
  });
});

describe("getMessageLengthHint", () => {
  it("warns when SMS may use multiple segments", () => {
    const long = "x".repeat(170) + " {{name}}";
    const hint = getMessageLengthHint(long, "SMS");
    expect(hint).toMatch(/segment/i);
  });
});

describe("suggestMessage curated fallback", () => {
  it("returns a curated draft when OpenAI is unavailable", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      const result = await suggestMessage({
        occasionName: "Birthday",
        channel: "SMS",
        tone: "warm",
        variantCount: 1,
      });

      expect(result.provider).toBe("curated");
      expect(result.body).toContain("{{name}}");
      expect(result.tone).toBe("warm");
    } finally {
      if (previous === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previous;
      }
    }
  });

  it("returns three curated variants", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      const result = await suggestMessageVariants({
        occasionName: "Anniversary",
        channel: "WHATSAPP",
        tone: "short",
        variantCount: 3,
      });

      expect(result.variants).toHaveLength(3);
      expect(result.provider).toBe("curated");
      for (const variant of result.variants) {
        expect(variant).toContain("{{name}}");
      }
    } finally {
      if (previous === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previous;
      }
    }
  });

  it("rewrites with curated fallback", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      const result = await rewriteMessage({
        body: "Hello {{name}}, happy birthday to you!",
        channel: "SMS",
        occasionName: "Birthday",
        action: "shorter",
      });

      expect(result.provider).toBe("curated");
      expect(result.body).toContain("{{name}}");
      expect(result.action).toBe("shorter");
    } finally {
      if (previous === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previous;
      }
    }
  });
});
