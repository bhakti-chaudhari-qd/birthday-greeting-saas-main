import { UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AUTOMATION_TIMEZONE } from "@/lib/automation/constants";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { getDashboardHomeSummary } from "@/lib/dashboard/home-summary";
import { createContact } from "@/lib/contacts/service";
import { prisma } from "@/lib/db";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { getOrganizationLocalIsoDate } from "@/lib/queue/dates";
import { createTemplate } from "@/lib/templates/service";

import { uniqueIndianMobile as testMobile, uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registerInput(suffix: string) {
  return {
    organizationName: `Home Alerts Org ${suffix}`,
    organizationSlug: `home-alerts-org-${suffix}`,
    timezone: "UTC",
    adminName: "Home Alerts Admin",
    email: `home-alerts-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

/** Any year works - occasion matching is month/day only. */
function birthdayDateForTodayMonthDay(todayIso: string): string {
  const [, month, day] = todayIso.split("-");
  return `1990-${month}-${day}`;
}

const GREETING_ROUTES_OFF_SUBSTRING = "greeting routes are off";

describe("dashboard home alerts", () => {
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

  it("does not warn that greeting routes are off when only Email automation is enabled", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const todayIso = getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE);
    const birthdayDate = birthdayDateForTodayMonthDay(todayIso);

    const template = await createTemplate(org.organization.id, {
      name: "Birthday Email",
      occasionId: birthday.id,
      channel: "EMAIL",
      body: "Happy Birthday {{name}}!",
      emailSubject: "Happy Birthday!",
      isActive: true,
    });

    await createContact(org.organization.id, {
      name: "Email Only Contact",
      mobile: testMobile(),
      email: `email-only-${uniqueSuffix()}@test.local`,
      occasionDates: { [birthday.id]: birthdayDate },
      isActive: true,
    });

    await prisma.categoryAutomationRule.create({
      data: {
        organizationId: org.organization.id,
        occasionId: birthday.id,
        categoryId: null,
        sendHour: 9,
        sendMinute: 0,
        emailEnabled: true,
        emailTemplateId: template.id,
      },
    });

    const summary = await getDashboardHomeSummary(org.organization.id, UserRole.ADMIN);

    expect(summary.scheduledTodayCount).toBeGreaterThan(0);
    expect(
      summary.alerts.some((alert) =>
        alert.message.includes(GREETING_ROUTES_OFF_SUBSTRING),
      ),
    ).toBe(false);

    await cleanupOrganization(org.organization.id);
  });

  it("still warns when no channel automation is enabled for today's occasion", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    const todayIso = getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE);
    const birthdayDate = birthdayDateForTodayMonthDay(todayIso);

    await createContact(org.organization.id, {
      name: "No Automation Contact",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: birthdayDate },
      isActive: true,
    });

    const summary = await getDashboardHomeSummary(org.organization.id, UserRole.ADMIN);

    // scheduledTodayCount only counts contacts who already resolved to an
    // enabled automated channel, so it's correctly 0 here - nothing is
    // configured. The alert relies on the unfiltered rawTotal instead, which
    // is what makes it fire in exactly this "nothing set up" case.
    expect(summary.scheduledTodayCount).toBe(0);
    expect(
      summary.alerts.some((alert) =>
        alert.message.includes(GREETING_ROUTES_OFF_SUBSTRING),
      ),
    ).toBe(true);
    expect(
      summary.alerts.find((alert) =>
        alert.message.includes(GREETING_ROUTES_OFF_SUBSTRING),
      )?.message,
    ).toContain("1 person has an occasion today");

    await cleanupOrganization(org.organization.id);
  });
});
