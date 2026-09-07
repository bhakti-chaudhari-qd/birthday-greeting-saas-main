import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ChannelProvider } from "@prisma/client";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { upsertWhatsAppChannelConfig } from "@/lib/channel-config/whatsapp-service";
import { prisma } from "@/lib/db";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import {
  createWhatsAppMediaAsset,
  getWhatsAppMediaAsset,
  WhatsAppMediaAssetError,
} from "@/lib/media/whatsapp-media-assets";
import {
  executeManualSend,
  previewManualSend,
} from "@/lib/queue/manual-send";
import { claimQueueItemsForOrganization } from "@/lib/queue/claim";
import { processClaimedQueueItem } from "@/lib/queue/send";
import { testProvider } from "@/lib/messaging/providers/test-provider";
import { createTemplate } from "@/lib/templates/service";

import { uniqueIndianMobile, uniqueSuffix } from "./helpers";
import { TEST_CREDENTIALS_ENCRYPTION_KEY } from "./sms-test-helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registrationInput(suffix: string) {
  return {
    organizationName: `Media Org ${suffix}`,
    organizationSlug: `media-org-${suffix}`,
    timezone: "UTC",
    adminName: "Media Admin",
    email: `media-${suffix}@test.local`,
    password: "password12345",
  };
}

describe("WhatsApp greeting media assets", () => {
  beforeAll(async () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_CREDENTIALS_ENCRYPTION_KEY;
    if (!databaseUrl) return;
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  afterAll(async () => {
    if (databaseAvailable) await prisma.$disconnect();
  });

  it("keeps media tenant-scoped and snapshots it into preview and queue", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const orgA = await createRegisteredOrganization(
      registrationInput(uniqueSuffix()),
    );
    const orgB = await createRegisteredOrganization(
      registrationInput(uniqueSuffix()),
    );
    const originalSend = testProvider.send;

    try {
      await upsertWhatsAppChannelConfig(orgA.organization.id, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });
      const bytes = Buffer.from([
        0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f,
        0x6d,
      ]);
      const asset = await createWhatsAppMediaAsset(orgA.organization.id, {
        mediaBase64: bytes.toString("base64"),
        filename: "birthday.mp4",
        contentType: "video/mp4",
      });

      await expect(
        getWhatsAppMediaAsset(orgB.organization.id, asset.id),
      ).rejects.toBeInstanceOf(WhatsAppMediaAssetError);

      const birthday = await ensureSystemBirthdayOccasion(orgA.organization.id);
      const template = await createTemplate(orgA.organization.id, {
        name: "Birthday video",
        occasionId: birthday.id,
        channel: "WHATSAPP",
        body: "Happy Birthday {{name}}!",
        whatsappTemplateName: "test_birthday",
        whatsappLanguage: "en",
        whatsappMediaAssetId: asset.id,
        isActive: true,
      });
      const contact = await prisma.contact.create({
        data: {
          organizationId: orgA.organization.id,
          name: "Alex",
          mobile: uniqueIndianMobile(),
          isActive: true,
        },
      });

      const preview = await previewManualSend(orgA.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      });
      expect(preview.media).toMatchObject({
        filename: "birthday.mp4",
        contentType: "video/mp4",
      });

      await executeManualSend(orgA.organization.id, {
        templateId: template.id,
        contactIds: [contact.id],
      }, { createdByUserId: orgA.user.id });
      const queue = await prisma.sendQueue.findFirstOrThrow({
        where: { organizationId: orgA.organization.id, templateId: template.id },
      });
      expect(queue.whatsappMediaAssetId).toBe(asset.id);

      let mediaFilename: string | null = null;
      testProvider.send = async (request) => {
        if (request.channel === "WHATSAPP") {
          mediaFilename = request.media?.filename ?? null;
        }
        return originalSend(request);
      };
      const [claimed] = await claimQueueItemsForOrganization(
        orgA.organization.id,
        { limit: 1 },
      );
      expect(claimed).toBeTruthy();
      const result = await processClaimedQueueItem(
        orgA.organization.id,
        claimed!.id,
      );
      expect(result.status).toBe("sent");
      expect(mediaFilename).toBe("birthday.mp4");

      const log = await prisma.deliveryLog.findFirstOrThrow({
        where: { sendQueueId: queue.id },
      });
      expect(log.providerResponse).toMatchObject({
        media: { filename: "birthday.mp4", simulated: true },
      });
    } finally {
      testProvider.send = originalSend;
      await prisma.organization.delete({ where: { id: orgA.organization.id } });
      await prisma.organization.delete({ where: { id: orgB.organization.id } });
    }
  });
});
