import { describe, expect, it } from "vitest";

import {
  resolveWhatsAppMediaKind,
  templateNameForOccasionMedia,
  whatsappMediaKindFromContentType,
} from "@/lib/templates/whatsapp-template-name";

describe("whatsapp template naming", () => {
  it("derives media kind from content type", () => {
    expect(whatsappMediaKindFromContentType("image/jpeg")).toBe("IMAGE");
    expect(whatsappMediaKindFromContentType("video/mp4")).toBe("VIDEO");
    expect(whatsappMediaKindFromContentType("video/webm")).toBe("VIDEO");
    expect(whatsappMediaKindFromContentType(null)).toBeNull();
  });

  it("names templates for text, image, and video", () => {
    expect(templateNameForOccasionMedia("Birthday")).toBe("Birthday greeting");
    expect(templateNameForOccasionMedia("Birthday", "image/jpeg")).toBe(
      "Birthday Image message",
    );
    expect(templateNameForOccasionMedia("Anniversary", "video/mp4")).toBe(
      "Anniversary Video message",
    );
    expect(templateNameForOccasionMedia("Diwali", "video/webm")).toBe(
      "Diwali Video message",
    );
  });

  it("resolves media kind from content type or template name", () => {
    expect(
      resolveWhatsAppMediaKind({ contentType: "image/jpeg" }),
    ).toBe("IMAGE");
    expect(
      resolveWhatsAppMediaKind({
        contentType: null,
        name: "Birthday Image message",
      }),
    ).toBe("IMAGE");
    expect(
      resolveWhatsAppMediaKind({
        contentType: null,
        name: "Anniversary Video message",
      }),
    ).toBe("VIDEO");
    expect(
      resolveWhatsAppMediaKind({
        contentType: null,
        name: "Custom Image message (All groups)",
      }),
    ).toBe("IMAGE");
    expect(
      resolveWhatsAppMediaKind({
        contentType: null,
        name: "Birthday greeting",
      }),
    ).toBeNull();
  });
});
