import { describe, expect, it } from "vitest";

import {
  WHATSAPP_TEMPLATE_LANGUAGES,
  findWhatsAppTemplateLanguage,
  whatsappLanguageSchema,
} from "@/lib/templates/whatsapp-metadata";

describe("WHATSAPP_TEMPLATE_LANGUAGES", () => {
  it("includes a sufficiently complete set of common languages, not just a handful", () => {
    expect(WHATSAPP_TEMPLATE_LANGUAGES.length).toBeGreaterThan(40);
  });

  it("includes English, Hindi, Marathi, Gujarati, Bengali, Kannada, Malayalam, Punjabi, Tamil, Telugu, and Urdu with their WhatsApp codes", () => {
    const byCode = new Map(
      WHATSAPP_TEMPLATE_LANGUAGES.map((language) => [language.code, language.name]),
    );

    expect(byCode.get("en")).toBe("English");
    expect(byCode.get("hi")).toBe("Hindi");
    expect(byCode.get("mr")).toBe("Marathi");
    expect(byCode.get("gu")).toBe("Gujarati");
    expect(byCode.get("bn")).toBe("Bengali");
    expect(byCode.get("kn")).toBe("Kannada");
    expect(byCode.get("ml")).toBe("Malayalam");
    expect(byCode.get("pa")).toBe("Punjabi");
    expect(byCode.get("ta")).toBe("Tamil");
    expect(byCode.get("te")).toBe("Telugu");
    expect(byCode.get("ur")).toBe("Urdu");
  });

  it("has no duplicate codes", () => {
    const codes = WHATSAPP_TEMPLATE_LANGUAGES.map((language) => language.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("has no duplicate names", () => {
    const names = WHATSAPP_TEMPLATE_LANGUAGES.map((language) => language.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every listed code matches the existing server-side format validator", () => {
    for (const language of WHATSAPP_TEMPLATE_LANGUAGES) {
      const result = whatsappLanguageSchema.safeParse(language.code);
      expect(result.success, `${language.code} should be a valid WhatsApp language code`).toBe(
        true,
      );
    }
  });
});

describe("findWhatsAppTemplateLanguage", () => {
  it("resolves a stored language code back to its language", () => {
    expect(findWhatsAppTemplateLanguage("en")).toEqual({ code: "en", name: "English" });
    expect(findWhatsAppTemplateLanguage("mr")).toEqual({ code: "mr", name: "Marathi" });
  });

  it("is case-insensitive", () => {
    expect(findWhatsAppTemplateLanguage("EN")).toEqual({ code: "en", name: "English" });
    expect(findWhatsAppTemplateLanguage("Mr")).toEqual({ code: "mr", name: "Marathi" });
  });

  it("tolerates surrounding whitespace", () => {
    expect(findWhatsAppTemplateLanguage("  en  ")).toEqual({
      code: "en",
      name: "English",
    });
  });

  it("returns undefined for a code that is not in the list, without throwing", () => {
    expect(findWhatsAppTemplateLanguage("not-a-real-code")).toBeUndefined();
  });
});
