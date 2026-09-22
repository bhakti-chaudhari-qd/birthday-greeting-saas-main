import { Channel, ChannelProvider } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { upsertWhatsAppChannelConfig } from "@/lib/channel-config/whatsapp-service";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { previewManualSend } from "@/lib/queue/manual-send";
import { createTemplate } from "@/lib/templates/service";
import { prisma } from "@/lib/db";
import { uniqueSuffix } from "./helpers";
import { TEST_CREDENTIALS_ENCRYPTION_KEY } from "./sms-test-helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registerInput(suffix: string) {
  return {
    organizationName: `Manual Send Meta Org ${suffix}`,
    organizationSlug: `manual-send-meta-org-${suffix}`,
    timezone: "UTC",
    adminName: "Manual Send Meta Admin",
    email: `manual-send-meta-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("manual send: WhatsApp Meta Cloud API provider", () => {
  beforeAll(async () => {
    if (!databaseUrl) return;
    databaseAvailable = true;
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_CREDENTIALS_ENCRYPTION_KEY;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.$disconnect();
    }
  });

  it("accepts a Meta-configured WhatsApp template for manual send preview (no longer rejected as unsupported)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

    await upsertWhatsAppChannelConfig(org.organization.id, {
      provider: ChannelProvider.META,
      isActive: true,
      phoneNumberId: "1320947411098948",
      accessToken: "test-meta-access-token",
    });

    const template = await createTemplate(org.organization.id, {
      name: "WhatsApp Meta",
      occasionId: birthday.id,
      channel: "WHATSAPP",
      body: "Hello {{name}}!",
      isActive: true,
      whatsappTemplateName: "hello_template",
      whatsappLanguage: "en_US",
    });

    const preview = await previewManualSend(org.organization.id, {
      templateId: template.id,
      recipients: [
        { name: "Alice", mobile: "9876543210" },
      ],
    });

    expect(preview.providerMode).toBe("META");
    expect(preview.providerModeLabel).toBe("Meta Cloud API");
    expect(preview.template.realSmsStatusLabel).toBe("Meta Cloud API");

    await cleanupOrganization(org.organization.id);
  });

  it("stores and reads back the phone number ID / access-token-configured flag", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    const config = await upsertWhatsAppChannelConfig(org.organization.id, {
      provider: ChannelProvider.META,
      isActive: true,
      phoneNumberId: "1320947411098948",
      accessToken: "test-meta-access-token",
    });

    expect(config.provider).toBe(ChannelProvider.META);
    expect(config.phoneNumberId).toBe("1320947411098948");
    expect(config.accessTokenConfigured).toBe(true);
    expect(config.credentialsConfigured).toBe(true);

    await cleanupOrganization(org.organization.id);
  });

  it("keeps the existing access token when a later save omits it", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    await upsertWhatsAppChannelConfig(org.organization.id, {
      provider: ChannelProvider.META,
      isActive: true,
      phoneNumberId: "1320947411098948",
      accessToken: "original-token",
    });

    const updated = await upsertWhatsAppChannelConfig(org.organization.id, {
      provider: ChannelProvider.META,
      isActive: true,
      phoneNumberId: "1320947411098948",
      apiVersion: "v22.0",
    });

    expect(updated.accessTokenConfigured).toBe(true);
    expect(updated.apiVersion).toBe("v22.0");

    await cleanupOrganization(org.organization.id);
  });
});
