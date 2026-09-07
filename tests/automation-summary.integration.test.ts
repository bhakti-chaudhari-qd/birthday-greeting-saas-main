import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getAutomationSummary } from "@/lib/automation/summary";
import { updateCategoryAutomationRules } from "@/lib/automation/category-settings";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { createTemplate } from "@/lib/templates/service";
import { prisma } from "@/lib/db";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

describe("automation summary", () => {
  beforeAll(async () => {
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
    await prisma.$disconnect();
  });

  it("reports disabled automations by default and enabled labels after setup", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const suffix = uniqueSuffix();
    const registered = await createRegisteredOrganization({
      organizationName: `Summary Org ${suffix}`,
      organizationSlug: `summary-org-${suffix}`,
      timezone: "UTC",
      adminName: "Summary Admin",
      email: `summary-${suffix}@test.local`,
      password: "password12345",
    });
    const organizationId = registered.organization.id;

    try {
      const birthday = await ensureSystemBirthdayOccasion(organizationId);

      const before = await getAutomationSummary(organizationId);
      expect(before.anyEnabled).toBe(false);
      expect(before.enabledLabels).toEqual([]);
      const birthdayBefore = before.occasions.find(
        (occasion) => occasion.occasionId === birthday.id,
      );
      expect(birthdayBefore?.smsEnabled).toBe(false);
      expect(birthdayBefore?.whatsappEnabled).toBe(false);
      expect(before.today.targetDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const template = await createTemplate(organizationId, {
        name: "Summary Birthday SMS",
        occasionId: birthday.id,
        channel: "SMS",
        body: "Happy Birthday {{name}}!",
        isActive: true,
      });

      await updateCategoryAutomationRules(organizationId, {
        occasionId: birthday.id,
        rules: [],
        allContactsRule: {
          sendHour: 9,
          sendMinute: 30,
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

      const after = await getAutomationSummary(organizationId);
      expect(after.anyEnabled).toBe(true);
      expect(after.enabledLabels).toContain("SMS Birthday");
      const birthdayAfter = after.occasions.find(
        (occasion) => occasion.occasionId === birthday.id,
      );
      expect(birthdayAfter?.smsEnabled).toBe(true);
      expect(birthdayAfter?.sendTimeLabel).toBe("9:30 AM IST");
    } finally {
      await prisma.organization.delete({ where: { id: organizationId } });
    }
  });
});
