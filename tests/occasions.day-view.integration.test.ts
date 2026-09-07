import { Channel, QueueStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { uniqueIndianMobile as testMobile, uniqueSuffix } from "./helpers";

import { updateCategoryAutomationRules } from "@/lib/automation/category-settings";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createContact } from "@/lib/contacts/service";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { prisma } from "@/lib/db";
import { getOccasionsDayView } from "@/lib/queue/occasions-day-view";
import { createTemplate } from "@/lib/templates/service";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

describe("occasions day view", () => {
  beforeAll(async () => {
    if (!databaseUrl) {
      return;
    }

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

  it("lists birthday contacts with template preview and queue status for a date", async ({
    skip,
  }) => {
    if (!databaseAvailable) {
      skip();
      return;
    }

    const suffix = uniqueSuffix();
    const { organization } = await createRegisteredOrganization({
      organizationName: `Occasions Org ${suffix}`,
      organizationSlug: `occasions-org-${suffix}`,
      timezone: "UTC",
      adminName: "Occasions Admin",
      email: `occasions-${suffix}@test.local`,
      password: "password12345",
    });

    try {
      const birthday = await ensureSystemBirthdayOccasion(organization.id);
      const template = await createTemplate(organization.id, {
        name: "Birthday SMS",
        occasionId: birthday.id,
        channel: Channel.SMS,
        body: "Happy Birthday {{name}}!",
        isActive: true,
      });

      await updateCategoryAutomationRules(organization.id, {
        occasionId: birthday.id,
        rules: [],
        allContactsRule: {
          sendHour: 6,
          sendMinute: 0,
          smsEnabled: true,
          smsTemplateId: template.id,
          whatsappEnabled: false,
          whatsappTemplateId: null,
          emailEnabled: false,
          emailTemplateId: null,
          callEnabled: false,
          aiAssistEnabled: false,
        },
      });

      const birthdayContact = await createContact(organization.id, {
        name: "Birthday Person",
        mobile: testMobile(),
        occasionDates: { [birthday.id]: "1990-07-14" },

        isActive: true,
      });

      await createContact(organization.id, {
        name: "Other Person",
        mobile: testMobile(),
        occasionDates: { [birthday.id]: "1990-01-15" },

        isActive: true,
      });

      await prisma.sendQueue.create({
        data: {
          organizationId: organization.id,
          contactId: birthdayContact.id,
          recipientName: birthdayContact.name,
          recipientMobile: birthdayContact.mobile,
          recipientEmail: birthdayContact.email,
          templateId: template.id,
          channel: Channel.SMS,
          occasionId: birthday.id,
          scheduledDate: new Date(Date.UTC(2026, 6, 14)),
          renderedBody: "Happy Birthday Birthday Person!",
          status: QueueStatus.SENT,
          sentAt: new Date("2026-07-14T14:30:00.000Z"),
          idempotencyKey: `occasions-test-${suffix}`,
        },
      });

      const view = await getOccasionsDayView(organization.id, "2026-07-14");

      expect(view.summary.byOccasion[birthday.id]).toBe(1);
      expect(view.summary.total).toBe(1);
      expect(view.sections[0]?.label).toBe("Birthday");
      expect(view.sections[0]?.automationEnabled).toBe(true);
      expect(view.sections[0]?.contacts[0]?.smsTemplateName).toBe(
        "Birthday SMS",
      );
      expect(view.sections[0]?.contacts).toEqual([
        expect.objectContaining({
          id: birthdayContact.id,
          name: "Birthday Person",
          messagePreview: "Happy Birthday Birthday Person!",
          deliveryStatus: "sent",
          sentAt: "2026-07-14T14:30:00.000Z",
          failureReason: null,
        }),
      ]);
    } finally {
      await cleanupOrganization(organization.id);
    }
  });
});
