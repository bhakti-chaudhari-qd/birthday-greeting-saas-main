import { describe, expect, it } from "vitest";

import { getMessagesDict } from "@/lib/i18n/dictionaries/messages";
import { LOCALES } from "@/lib/i18n/constants";

const DEVANAGARI_PATTERN = /[ऀ-ॿ]/;

function checkStrings(value: unknown, path: string): void {
  if (typeof value === "string") {
    expect(value.length, `${path} should not be empty`).toBeGreaterThan(0);
    return;
  }
  if (typeof value === "function") {
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      checkStrings(entry, `${path}.${key}`);
    }
  }
}

describe("messages i18n", () => {
  it("every string leaf is non-empty across all locales", () => {
    for (const locale of LOCALES) {
      checkStrings(getMessagesDict(locale), `messages.${locale}`);
    }
  });

  it("hi/mr contain Devanagari script", () => {
    const hi = getMessagesDict("hi");
    const mr = getMessagesDict("mr");

    expect(hi.whatsappPreview.label).toMatch(DEVANAGARI_PATTERN);
    expect(hi.whatsappPreview.disclaimer).toMatch(DEVANAGARI_PATTERN);

    expect(mr.whatsappPreview.label).toMatch(DEVANAGARI_PATTERN);
    expect(mr.whatsappPreview.disclaimer).toMatch(DEVANAGARI_PATTERN);

    expect(hi.imageOverlay.footerLabel).toMatch(DEVANAGARI_PATTERN);
    expect(mr.imageOverlay.footerLabel).toMatch(DEVANAGARI_PATTERN);

    expect(hi.composer.title).toMatch(DEVANAGARI_PATTERN);
    expect(mr.composer.title).toMatch(DEVANAGARI_PATTERN);

    expect(hi.manualSend.pageTitle).toMatch(DEVANAGARI_PATTERN);
    expect(mr.manualSend.pageTitle).toMatch(DEVANAGARI_PATTERN);
    expect(hi.manualSend.results.heading).toMatch(DEVANAGARI_PATTERN);
    expect(mr.manualSend.results.heading).toMatch(DEVANAGARI_PATTERN);
  });

  it("hi and mr are genuinely distinct translations", () => {
    const hi = getMessagesDict("hi");
    const mr = getMessagesDict("mr");

    expect(hi.whatsappPreview.emptyVideo).not.toBe(mr.whatsappPreview.emptyVideo);
    expect(hi.whatsappPreview.disclaimer).not.toBe(mr.whatsappPreview.disclaimer);
    expect(hi.imageOverlay.footerHintDefault).not.toBe(mr.imageOverlay.footerHintDefault);
    expect(hi.composer.defaultBody).not.toBe(mr.composer.defaultBody);
  });

  it("composer default body/subject contain the {{name}} placeholder in all locales", () => {
    for (const locale of LOCALES) {
      const dict = getMessagesDict(locale);
      expect(dict.composer.defaultBody).toContain("{{name}}");
      expect(dict.composer.defaultEmailSubject).toContain("{{name}}");
    }
  });

  it("manualSend interpolated values appear in generated strings", () => {
    for (const locale of LOCALES) {
      const dict = getMessagesDict(locale);
      expect(dict.manualSend.preselectedContacts(5)).toContain("5");
      expect(dict.manualSend.suggestedTemplate("VIP")).toContain("VIP");
      expect(dict.manualSend.sendingBatch(1, 3, 100)).toContain("1");
      expect(dict.manualSend.sendingBatch(1, 3, 100)).toContain("3");
      expect(dict.manualSend.sendingBatch(1, 3, 100)).toContain("100");
      expect(dict.manualSend.failedOnBatch(2, 4, 50)).toContain("2");
      expect(dict.manualSend.networkErrorBatching(10)).toContain("10");
      expect(dict.manualSend.audience.activeContacts(42)).toContain("42");
      expect(dict.manualSend.setup.noSavedMessages("SMS")).toContain("SMS");
      expect(dict.manualSend.preview.batchesOfUpTo(3, 200)).toContain("3");
      expect(dict.manualSend.preview.batchesOfUpTo(3, 200)).toContain("200");
      expect(dict.manualSend.preview.confirmSendBatches(4)).toContain("4");
    }
  });

  it("manualSend hi and mr are genuinely distinct translations", () => {
    const hi = getMessagesDict("hi");
    const mr = getMessagesDict("mr");

    expect(hi.manualSend.pageTitle).not.toBe(mr.manualSend.pageTitle);
    expect(hi.manualSend.results.heading).not.toBe(mr.manualSend.results.heading);
    expect(hi.manualSend.emailComposer.heading).not.toBe(mr.manualSend.emailComposer.heading);
  });

  it("English defaults match the original hardcoded strings", () => {
    const dict = getMessagesDict("en");
    expect(dict.whatsappPreview.label).toBe("WhatsApp preview");
    expect(dict.whatsappPreview.online).toBe("online");
    expect(dict.whatsappPreview.videoPlaceholder).toBe("Video will appear here");
    expect(dict.whatsappPreview.imagePlaceholder).toBe("Image will appear here");
    expect(dict.whatsappPreview.emptyText).toBe(
      "Type or suggest a message to preview it on WhatsApp.",
    );
    expect(dict.imageOverlay.footerLabel).toBe("Footer image");
    expect(dict.imageOverlay.uploadFooterImage).toBe("Upload footer image");
    expect(dict.imageOverlay.removeFooter).toBe("Remove footer");
    expect(dict.composer.title).toBe("Create a message");
    expect(dict.composer.writeWithAi).toBe("Write with AI");
    expect(dict.composer.useThisMessage).toBe("Use this message");
    expect(dict.composer.occasionNames.birthday).toBe("Birthday");
    expect(dict.manualSend.pageTitle).toBe("Send Messages");
    expect(dict.manualSend.results.heading).toBe("Greeting ready");
    expect(dict.manualSend.audience.heading).toBe("Audience");
    expect(dict.manualSend.preview.confirmSend).toBe("Confirm Send");
    expect(dict.manualSend.emailComposer.saveMessage).toBe("Save message");
  });
});
