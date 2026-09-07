import { describe, expect, it } from "vitest";

import {
  isPerContactPersonalizedGreetingMedia,
  needsGreetingVideoPreviewRebuild,
  shouldPersonalizeWhatsAppMedia,
} from "@/lib/media/greeting-video-filename";

describe("shouldPersonalizeWhatsAppMedia", () => {
  it("matches app-generated greeting filenames", () => {
    expect(shouldPersonalizeWhatsAppMedia("greeting-birthday.webm")).toBe(true);
    expect(shouldPersonalizeWhatsAppMedia("greeting-anniversary.mp4")).toBe(
      true,
    );
    expect(shouldPersonalizeWhatsAppMedia("greeting-custom.webm")).toBe(true);
  });

  it("leaves custom uploads alone", () => {
    expect(shouldPersonalizeWhatsAppMedia("company-intro.mp4")).toBe(false);
    expect(shouldPersonalizeWhatsAppMedia("video.webm")).toBe(false);
    expect(shouldPersonalizeWhatsAppMedia(null)).toBe(false);
  });
});

describe("needsGreetingVideoPreviewRebuild", () => {
  it("rebuilds sample template videos and missing filenames", () => {
    expect(needsGreetingVideoPreviewRebuild("greeting-birthday.webm")).toBe(
      true,
    );
    expect(needsGreetingVideoPreviewRebuild(null)).toBe(true);
    expect(needsGreetingVideoPreviewRebuild("")).toBe(true);
  });

  it("does not rebuild per-contact or custom uploads", () => {
    expect(
      needsGreetingVideoPreviewRebuild("greeting-birthday-a1b2c3.webm"),
    ).toBe(false);
    expect(needsGreetingVideoPreviewRebuild("company-intro.mp4")).toBe(false);
    expect(isPerContactPersonalizedGreetingMedia("greeting-custom-zz99.mp4")).toBe(
      true,
    );
  });
});
