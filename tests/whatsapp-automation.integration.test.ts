import { Channel, ChannelProvider } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { updateCategoryAutomationRules } from "@/lib/automation/category-settings";
import { runOccasionAutomation } from "@/lib/automation/run-occasion";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { upsertSmsChannelConfig } from "@/lib/channel-config/service";
import { upsertWhatsAppChannelConfig } from "@/lib/channel-config/whatsapp-service";
import { prisma } from "@/lib/db";
import { createOccasion, ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { getOccasionsDayView } from "@/lib/queue/occasions-day-view";
import { createTemplate } from "@/lib/templates/service";

import { TEST_CREDENTIALS_ENCRYPTION_KEY } from "./sms-test-helpers";

let databaseAvailable = false;

function suffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe("WhatsApp occasion automation", () => {
  beforeAll(async () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_CREDENTIALS_ENCRYPTION_KEY;
    if (!process.env.DATABASE_URL) return;

    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("queues WhatsApp greetings for Birthday and two user-created occasions", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const id = suffix();
    const registered = await createRegisteredOrganization({
      organizationName: `WhatsApp Automation ${id}`,
      organizationSlug: `whatsapp-automation-${id}`,
      timezone: "UTC",
      adminName: "Automation Admin",
      email: `whatsapp-automation-${id}@test.local`,
      password: "password12345",
    });
    const organizationId = registered.organization.id;

    try {
      await upsertWhatsAppChannelConfig(organizationId, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });
      await upsertSmsChannelConfig(organizationId, {
        provider: ChannelProvider.TEST,
        isActive: true,
      });

      const birthdayOccasion = await ensureSystemBirthdayOccasion(organizationId);
      const anniversaryOccasion = await createOccasion(organizationId, "Anniversary");
      const diwaliOccasion = await createOccasion(organizationId, "Diwali");

      const [
        birthdayTemplate,
        anniversaryTemplate,
        diwaliTemplate,
        smsBirthdayTemplate,
      ] = await Promise.all([
        createTemplate(organizationId, {
          name: "WA Birthday",
          occasionId: birthdayOccasion.id,
          channel: Channel.WHATSAPP,
          body: "Happy birthday {{name}}!",
          isActive: true,
          whatsappTemplateName: "wa_birthday",
          whatsappLanguage: "en",
        }),
        createTemplate(organizationId, {
          name: "WA Anniversary",
          occasionId: anniversaryOccasion.id,
          channel: Channel.WHATSAPP,
          body: "Happy anniversary {{name}}!",
          isActive: true,
          whatsappTemplateName: "wa_anniversary",
          whatsappLanguage: "en",
        }),
        createTemplate(organizationId, {
          name: "WA Diwali",
          occasionId: diwaliOccasion.id,
          channel: Channel.WHATSAPP,
          body: "Best wishes {{name}}!",
          isActive: true,
          whatsappTemplateName: "wa_diwali",
          whatsappLanguage: "en",
        }),
        createTemplate(organizationId, {
          name: "SMS Birthday",
          occasionId: birthdayOccasion.id,
          channel: Channel.SMS,
          body: "SMS birthday wishes {{name}}!",
          isActive: true,
        }),
      ]);

      const contact = await prisma.contact.create({
        data: {
          organizationId,
          name: "Priya",
          mobile: `9197${Date.now().toString().slice(-6)}`,
        },
      });

      const occasionDate = new Date(Date.UTC(2000, 6, 14));
      await prisma.contactOccasionDate.createMany({
        data: [
          {
            organizationId,
            contactId: contact.id,
            occasionId: birthdayOccasion.id,
            date: occasionDate,
            month: 7,
            day: 14,
          },
          {
            organizationId,
            contactId: contact.id,
            occasionId: anniversaryOccasion.id,
            date: occasionDate,
            month: 7,
            day: 14,
          },
          {
            organizationId,
            contactId: contact.id,
            occasionId: diwaliOccasion.id,
            date: occasionDate,
            month: 7,
            day: 14,
          },
        ],
      });

      await updateCategoryAutomationRules(organizationId, {
        occasionId: birthdayOccasion.id,
        rules: [],
        allContactsRule: {
          sendHour: 6,
          sendMinute: 0,
          smsEnabled: true,
          smsTemplateId: smsBirthdayTemplate.id,
          whatsappEnabled: true,
          whatsappTemplateId: birthdayTemplate.id,
          emailEnabled: false,
          emailTemplateId: null,
          callEnabled: false,
          aiAssistEnabled: false,
        },
      });
      await updateCategoryAutomationRules(organizationId, {
        occasionId: anniversaryOccasion.id,
        rules: [],
        allContactsRule: {
          sendHour: 6,
          sendMinute: 0,
          smsEnabled: false,
          smsTemplateId: null,
          whatsappEnabled: true,
          whatsappTemplateId: anniversaryTemplate.id,
          emailEnabled: false,
          emailTemplateId: null,
          callEnabled: false,
          aiAssistEnabled: false,
        },
      });
      await updateCategoryAutomationRules(organizationId, {
        occasionId: diwaliOccasion.id,
        rules: [],
        allContactsRule: {
          sendHour: 6,
          sendMinute: 0,
          smsEnabled: false,
          smsTemplateId: null,
          whatsappEnabled: true,
          whatsappTemplateId: diwaliTemplate.id,
          emailEnabled: false,
          emailTemplateId: null,
          callEnabled: false,
          aiAssistEnabled: false,
        },
      });

      const reference = new Date("2026-07-14T04:00:00.000Z");
      const [birthday, anniversary, diwali] = await Promise.all([
        runOccasionAutomation(birthdayOccasion.id, reference),
        runOccasionAutomation(anniversaryOccasion.id, reference),
        runOccasionAutomation(diwaliOccasion.id, reference),
      ]);

      expect(birthday.totalCreated).toBe(2);
      expect(anniversary.totalCreated).toBe(1);
      expect(diwali.totalCreated).toBe(1);

      const rows = await prisma.sendQueue.findMany({
        where: { organizationId },
        orderBy: { occasionId: "asc" },
      });
      expect(rows).toHaveLength(4);
      expect(rows.map((row) => row.occasionId).sort()).toEqual(
        [
          birthdayOccasion.id,
          birthdayOccasion.id,
          anniversaryOccasion.id,
          diwaliOccasion.id,
        ].sort(),
      );
      for (const row of rows.filter(
        (queueRow) => queueRow.channel === Channel.WHATSAPP,
      )) {
        expect(row.whatsappTemplateName).toBeTruthy();
        expect(row.whatsappLanguage).toBe("en");
        expect(row.whatsappParameterValues).toEqual(["Priya"]);
      }

      const dayView = await getOccasionsDayView(organizationId, "2026-07-14");
      expect(dayView.sections).toHaveLength(3);
      for (const section of dayView.sections) {
        expect(section.whatsappAutomationEnabled).toBe(true);
        expect(section.contacts[0]?.whatsappDeliveryStatus).toBe("pending");
        expect(section.contacts[0]?.whatsappMessagePreview).toContain("Priya");
      }
      expect(
        dayView.sections.find(
          (section) => section.occasionId === birthdayOccasion.id,
        )?.contacts[0]?.deliveryStatus,
      ).toBe("pending");
    } finally {
      await prisma.organization.delete({ where: { id: organizationId } });
    }
  });
});
