import { describe, expect, it } from "vitest";

import { translateOccasionName } from "@/lib/i18n/occasion-labels";

describe("translateOccasionName", () => {
  it("translates both built-in system occasions in Hindi and Marathi", () => {
    expect(translateOccasionName("Birthday", "hi")).toBe("जन्मदिन");
    expect(translateOccasionName("Anniversary", "hi")).toBe("एनिवर्सरी");
    expect(translateOccasionName("Birthday", "mr")).toBe("वाढदिवस");
    expect(translateOccasionName("Anniversary", "mr")).toBe("ॲनिव्हर्सरी");
  });

  it("leaves English and custom occasions unchanged", () => {
    expect(translateOccasionName("Birthday", "en")).toBe("Birthday");
    expect(translateOccasionName("Work Anniversary", "hi")).toBe("Work Anniversary");
  });
});
