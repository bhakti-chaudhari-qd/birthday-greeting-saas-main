import { describe, expect, it } from "vitest";

import {
  buildWhatsAppHttpSettings,
  resolveWhatsAppHttpProviderConfig,
} from "@/lib/channel-config/whatsapp-resolve";
import { serializeWhatsAppChannelConfig } from "@/lib/channel-config/whatsapp-serialize";
import {
  decodeWhatsAppMediaBase64,
  detectWhatsAppMediaContentType,
  isJpegBuffer,
  isMp4Buffer,
  isWebmBuffer,
} from "@/lib/channel-config/whatsapp-types";
import { encryptCredentials } from "@/lib/crypto/credentials";
import { getDefaultWhatsAppMediaJpeg } from "@/lib/messaging/providers/whatsapp/default-media";
import { Channel, ChannelProvider } from "@prisma/client";

import { withTestEncryptionKey } from "./sms-test-helpers";

const tinyJpeg = getDefaultWhatsAppMediaJpeg();
const tinyJpegBase64 = tinyJpeg.toString("base64");

/** Minimal EBML header - enough for WebM magic detection. */
const tinyWebm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]);
const tinyWebmBase64 = tinyWebm.toString("base64");

/** Minimal ISO BMFF with `ftyp` at offset 4. */
const tinyMp4 = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00,
  0x00, 0x00, 0x00, 0x69, 0x73, 0x6f, 0x6d,
]);
const tinyMp4Base64 = tinyMp4.toString("base64");

describe("WhatsApp Custom HTTP media helpers", () => {
  it("accepts JPEG magic bytes and rejects unknown payloads", () => {
    expect(isJpegBuffer(tinyJpeg)).toBe(true);
    expect(isJpegBuffer(Buffer.from("not-a-jpeg"))).toBe(false);
    expect(decodeWhatsAppMediaBase64(tinyJpegBase64).bytes.equals(tinyJpeg)).toBe(
      true,
    );
    expect(decodeWhatsAppMediaBase64(tinyJpegBase64).contentType).toBe(
      "image/jpeg",
    );
    expect(() => decodeWhatsAppMediaBase64("bm90LWEtcG5n")).toThrow(
      /JPEG|MP4|WebM/i,
    );
  });

  it("detects WebM and MP4 media", () => {
    expect(isWebmBuffer(tinyWebm)).toBe(true);
    expect(isMp4Buffer(tinyMp4)).toBe(true);
    expect(detectWhatsAppMediaContentType(tinyWebm)).toBe("video/webm");
    expect(detectWhatsAppMediaContentType(tinyMp4)).toBe("video/mp4");

    const webm = decodeWhatsAppMediaBase64(tinyWebmBase64);
    expect(webm.contentType).toBe("video/webm");
    expect(webm.bytes.equals(tinyWebm)).toBe(true);

    const mp4 = decodeWhatsAppMediaBase64(tinyMp4Base64);
    expect(mp4.contentType).toBe("video/mp4");
  });

  it("stores optional media on settings and resolves bytes for the provider", async () => {
    await withTestEncryptionKey(() => {
      const settings = buildWhatsAppHttpSettings(
        "https://wa.example.com",
        "/api/CustomAPI/CustomAPI_SendWhatsApp",
        {
          mediaBase64: tinyJpegBase64,
          mediaFilename: "greeting.jpg",
        },
      );

      expect(settings.mediaFilename).toBe("greeting.jpg");
      expect(settings.mediaContentType).toBe("image/jpeg");
      expect(settings.mediaBase64).toBeTruthy();

      const resolved = resolveWhatsAppHttpProviderConfig({
        id: "cfg-1",
        organizationId: "org-1",
        channel: Channel.WHATSAPP,
        provider: ChannelProvider.CUSTOM_HTTP,
        encryptedCredentials: encryptCredentials(
          JSON.stringify({ username: "demo", password: "" }),
        ),
        settings,
        vendorId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(resolved.mediaFilename).toBe("greeting.jpg");
      expect(resolved.mediaBytes?.equals(tinyJpeg)).toBe(true);
      expect(resolved.mediaContentType).toBe("image/jpeg");
    });
  });

  it("resolves video media with the correct content type", async () => {
    await withTestEncryptionKey(() => {
      const settings = buildWhatsAppHttpSettings(
        "https://wa.example.com",
        "/send",
        {
          mediaBase64: tinyWebmBase64,
          mediaFilename: "greeting.webm",
          mediaContentType: "video/webm",
        },
      );

      expect(settings.mediaContentType).toBe("video/webm");

      const resolved = resolveWhatsAppHttpProviderConfig({
        id: "cfg-2",
        organizationId: "org-1",
        channel: Channel.WHATSAPP,
        provider: ChannelProvider.CUSTOM_HTTP,
        encryptedCredentials: encryptCredentials(
          JSON.stringify({ username: "demo", password: "" }),
        ),
        settings,
        vendorId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(resolved.mediaContentType).toBe("video/webm");
      expect(resolved.mediaFilename).toBe("greeting.webm");
      expect(resolved.mediaBytes?.equals(tinyWebm)).toBe(true);
    });
  });

  it("serializes mediaConfigured without returning raw base64", async () => {
    await withTestEncryptionKey(() => {
      const settings = buildWhatsAppHttpSettings(
        "https://wa.example.com",
        "/send",
        {
          mediaBase64: tinyJpegBase64,
          mediaFilename: "card.jpg",
        },
      );

      const view = serializeWhatsAppChannelConfig({
        id: "cfg-1",
        organizationId: "org-1",
        channel: Channel.WHATSAPP,
        provider: ChannelProvider.CUSTOM_HTTP,
        encryptedCredentials: encryptCredentials(
          JSON.stringify({ username: "demo", password: "" }),
        ),
        settings,
        vendorId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(view.mediaConfigured).toBe(true);
      expect(view.mediaFilename).toBe("card.jpg");
      expect(view.mediaContentType).toBe("image/jpeg");
      expect(view).not.toHaveProperty("mediaBase64");
    });
  });

  it("serializes stored TEST media for local send simulation", async () => {
    await withTestEncryptionKey(() => {
      const view = serializeWhatsAppChannelConfig({
        id: "cfg-test",
        organizationId: "org-1",
        channel: Channel.WHATSAPP,
        provider: ChannelProvider.TEST,
        encryptedCredentials: encryptCredentials(
          JSON.stringify({ username: "test", password: "test" }),
        ),
        settings: {
          mediaBase64: tinyMp4Base64,
          mediaFilename: "local-greeting.mp4",
          mediaContentType: "video/mp4",
        },
        vendorId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(view.mediaConfigured).toBe(true);
      expect(view.mediaFilename).toBe("local-greeting.mp4");
      expect(view.mediaContentType).toBe("video/mp4");
      expect(view).not.toHaveProperty("mediaBase64");
    });
  });
});
