import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import {
  getCategoryAutomationSettings,
  updateCategoryAutomationRules,
} from "@/lib/automation/category-settings";
import { buildAutomationCards } from "@/components/automation/rule-utils";
import { ensureDefaultContactCategories } from "@/lib/contacts/categories";
import { createOccasion, ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { createTemplate } from "@/lib/templates/service";
import { updateCategoryAutomationRulesSchema } from "@/lib/validation/category-automation";
import { prisma } from "@/lib/db";
import { uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;
const TEST_OCCASION_ID = "cltest00000000000000000001";

function registerInput(suffix: string) {
  return {
    organizationName: `Category Routes Org ${suffix}`,
    organizationSlug: `category-routes-org-${suffix}`,
    timezone: "UTC",
    adminName: "Category Admin",
    email: `category-routes-${suffix}@test.local`,
    password: "password12345",
  };
}

describe("category automation settings", () => {
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

  it("rejects enabling SMS without a template", () => {
    const parsed = updateCategoryAutomationRulesSchema.safeParse({
      occasionId: TEST_OCCASION_ID,
      rules: [
        {
          categoryId: "cat-1",
          sendHour: 10,
          sendMinute: 0,
          smsEnabled: true,
          smsTemplateId: null,
          whatsappEnabled: false,
          whatsappTemplateId: null,
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("saves per-category birthday routes", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    await ensureDefaultContactCategories(org.organization.id);

    const template = await createTemplate(org.organization.id, {
      name: "VIP Birthday SMS",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
    });

    const settings = await getCategoryAutomationSettings(
      org.organization.id,
      birthday.id,
    );
    expect(settings.rules.length).toBeGreaterThanOrEqual(4);

    const vip = settings.rules.find((rule) => rule.categoryName === "VIP");
    expect(vip).toBeTruthy();

    const updated = await updateCategoryAutomationRules(org.organization.id, {
      occasionId: birthday.id,
      rules: [
        {
          categoryId: vip!.categoryId,
          sendHour: 10,
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
      ],
    });

    const savedVip = updated[0]?.rules.find((rule) => rule.categoryName === "VIP");
    expect(savedVip?.smsEnabled).toBe(true);
    expect(savedVip?.smsTemplateId).toBe(template.id);
    expect(savedVip?.sendHour).toBe(10);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("saves birthday and anniversary routes in one call", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const anniversary = await createOccasion(org.organization.id, "Anniversary");
    await ensureDefaultContactCategories(org.organization.id);

    const birthdayTemplate = await createTemplate(org.organization.id, {
      name: "Batch Birthday SMS",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
      replaceExisting: false,
    });
    const anniversaryTemplate = await createTemplate(org.organization.id, {
      name: "Batch Anniversary SMS",
      occasionId: anniversary.id,
      channel: "SMS",
      body: "Happy Anniversary {{name}}!",
      isActive: true,
      replaceExisting: false,
    });

    const birthdaySettings = await getCategoryAutomationSettings(
      org.organization.id,
      birthday.id,
    );
    const anniversarySettings = await getCategoryAutomationSettings(
      org.organization.id,
      anniversary.id,
    );
    const birthdayVip = birthdaySettings.rules.find(
      (rule) => rule.categoryName === "VIP",
    );
    const anniversaryVip = anniversarySettings.rules.find(
      (rule) => rule.categoryName === "VIP",
    );
    expect(birthdayVip && anniversaryVip).toBeTruthy();

    const updated = await updateCategoryAutomationRules(org.organization.id, {
      occasions: [
        {
          occasionId: birthday.id,
          rules: [
            {
              categoryId: birthdayVip!.categoryId,
              sendHour: 7,
              sendMinute: 0,
              smsEnabled: true,
              smsTemplateId: birthdayTemplate.id,
              whatsappEnabled: false,
              whatsappTemplateId: null,
              emailEnabled: false,
              emailTemplateId: null,
              callEnabled: false,
              aiAssistEnabled: false,
            },
          ],
        },
        {
          occasionId: anniversary.id,
          rules: [
            {
              categoryId: anniversaryVip!.categoryId,
              sendHour: 8,
              sendMinute: 15,
              smsEnabled: true,
              smsTemplateId: anniversaryTemplate.id,
              whatsappEnabled: false,
              whatsappTemplateId: null,
              emailEnabled: false,
              emailTemplateId: null,
              callEnabled: false,
              aiAssistEnabled: false,
            },
          ],
        },
      ],
    });

    expect(updated).toHaveLength(2);
    expect(
      updated
        .find((view) => view.occasionId === birthday.id)
        ?.rules.find((rule) => rule.categoryName === "VIP")?.sendHour,
    ).toBe(7);
    expect(
      updated
        .find((view) => view.occasionId === anniversary.id)
        ?.rules.find((rule) => rule.categoryName === "VIP")?.sendHour,
    ).toBe(8);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("shows only DLT SMS templates matching the selected occasion", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const diwali = await createOccasion(org.organization.id, "Diwali");
    await ensureDefaultContactCategories(org.organization.id);

    const birthdayTemplate = await createTemplate(org.organization.id, {
      name: "Provider Birthday DLT",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Dear User your {{name}} OTP for your app.",
      isActive: true,
      replaceExisting: false,
    });
    const diwaliTemplate = await createTemplate(org.organization.id, {
      name: "Provider Diwali DLT",
      occasionId: diwali.id,
      channel: "SMS",
      body: "Dear User your {{name}} OTP for your app.",
      isActive: true,
      replaceExisting: false,
    });

    const settings = await getCategoryAutomationSettings(
      org.organization.id,
      birthday.id,
    );
    expect(settings.eligibleSmsTemplates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: birthdayTemplate.id,
          name: "Provider Birthday DLT",
        }),
      ]),
    );
    expect(settings.eligibleSmsTemplates).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: diwaliTemplate.id,
          name: "Provider Diwali DLT",
        }),
      ]),
    );

    const friend = settings.rules.find((rule) => rule.categoryName === "Friend");
    expect(friend).toBeTruthy();

    const updated = await updateCategoryAutomationRules(org.organization.id, {
      occasionId: birthday.id,
      rules: [
        {
          categoryId: friend!.categoryId,
          sendHour: 10,
          sendMinute: 0,
          smsEnabled: true,
          smsTemplateId: birthdayTemplate.id,
          whatsappEnabled: false,
          whatsappTemplateId: null,
          emailEnabled: false,
          emailTemplateId: null,
          callEnabled: false,
          aiAssistEnabled: false,
        },
      ],
    });

    const savedFriend = updated[0]?.rules.find(
      (rule) => rule.categoryName === "Friend",
    );
    expect(savedFriend?.smsTemplateId).toBe(birthdayTemplate.id);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("keeps paused automations configured so status filters can show them", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    await ensureDefaultContactCategories(org.organization.id);

    const template = await createTemplate(org.organization.id, {
      name: "Paused Birthday SMS",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
      replaceExisting: false,
    });

    const settings = await getCategoryAutomationSettings(
      org.organization.id,
      birthday.id,
    );
    const vip = settings.rules.find((rule) => rule.categoryName === "VIP");
    expect(vip).toBeTruthy();

    await updateCategoryAutomationRules(org.organization.id, {
      occasionId: birthday.id,
      rules: [
        {
          categoryId: vip!.categoryId,
          sendHour: 10,
          sendMinute: 0,
          smsEnabled: false,
          smsTemplateId: template.id,
          whatsappEnabled: false,
          whatsappTemplateId: null,
          emailEnabled: false,
          emailTemplateId: null,
          callEnabled: false,
          aiAssistEnabled: false,
        },
      ],
    });

    const refreshed = await getCategoryAutomationSettings(
      org.organization.id,
      birthday.id,
    );
    const pausedVip = refreshed.rules.find((rule) => rule.categoryName === "VIP");
    expect(pausedVip?.smsEnabled).toBe(false);
    expect(pausedVip?.smsTemplateId).toBe(template.id);

    const cards = buildAutomationCards(birthday.id, birthday.name, refreshed);
    const card = cards.find((item) => item.categoryId === vip!.categoryId);
    expect(card?.status).toBe("paused");
    expect(card?.active).toBe(false);
    expect(card?.channels).toEqual([
      expect.objectContaining({
        channel: "SMS",
        templateId: template.id,
      }),
    ]);

    await updateCategoryAutomationRules(org.organization.id, {
      occasionId: birthday.id,
      rules: [
        {
          categoryId: vip!.categoryId,
          sendHour: 10,
          sendMinute: 0,
          smsEnabled: false,
          smsTemplateId: null,
          whatsappEnabled: false,
          whatsappTemplateId: null,
          emailEnabled: false,
          emailTemplateId: null,
          callEnabled: false,
          aiAssistEnabled: false,
        },
      ],
    });

    const disabledSettings = await getCategoryAutomationSettings(
      org.organization.id,
      birthday.id,
    );
    const disabledCard = buildAutomationCards(
      birthday.id,
      birthday.name,
      disabledSettings,
    ).find((item) => item.categoryId === vip!.categoryId);
    expect(disabledCard?.status).toBe("disabled");
    expect(disabledCard?.channels).toEqual([]);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });
});
