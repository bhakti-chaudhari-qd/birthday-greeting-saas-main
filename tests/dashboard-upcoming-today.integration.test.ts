import { Channel, QueueStatus, UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AUTOMATION_TIMEZONE } from "@/lib/automation/constants";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createContact } from "@/lib/contacts/service";
import { prisma } from "@/lib/db";
import { getDashboardHomeSummary } from "@/lib/dashboard/home-summary";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { getOrganizationLocalIsoDate, parseTargetDate } from "@/lib/queue/dates";
import { generateOccasionQueue } from "@/lib/queue/generate";
import { createTemplate } from "@/lib/templates/service";

import { uniqueIndianMobile as testMobile, uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function registerInput(suffix: string) {
  return {
    organizationName: `Upcoming Today Org ${suffix}`,
    organizationSlug: `upcoming-today-org-${suffix}`,
    timezone: "UTC",
    adminName: "Upcoming Today Admin",
    email: `upcoming-today-${suffix}@test.local`,
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

async function setupOrgWithTodayBirthday() {
  const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
  const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
  const todayIso = getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE);
  return { org, birthday, todayIso };
}

async function makeCategory(organizationId: string, name: string) {
  return prisma.contactCategoryDefinition.create({
    data: { organizationId, name },
  });
}

describe("dashboard upcoming today", () => {
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

  it("shows real pending SendQueue rows for today, ordered chronologically by send time (1, 2, 6)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday, todayIso } = await setupOrgWithTodayBirthday();
    const birthdayDate = birthdayDateForTodayMonthDay(todayIso);

    const familyCategory = await makeCategory(org.organization.id, "Family");
    const friendsCategory = await makeCategory(org.organization.id, "Friends");

    const template = await createTemplate(org.organization.id, {
      name: "Birthday SMS",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
    });

    // Later send time (6:15 PM), created first - deliberately out of order
    // on disk so the test proves sorting, not insertion order.
    const laterContact = await createContact(org.organization.id, {
      name: "Ishika",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: birthdayDate },
      categoryId: friendsCategory.id,
      isActive: true,
    });
    // Earlier send time (5:43 PM).
    const earlierContact = await createContact(org.organization.id, {
      name: "Maheen",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: birthdayDate },
      categoryId: familyCategory.id,
      isActive: true,
    });

    await prisma.categoryAutomationRule.create({
      data: {
        organizationId: org.organization.id,
        occasionId: birthday.id,
        categoryId: friendsCategory.id,
        sendHour: 18,
        sendMinute: 15,
        smsEnabled: true,
        smsTemplateId: template.id,
      },
    });
    await prisma.categoryAutomationRule.create({
      data: {
        organizationId: org.organization.id,
        occasionId: birthday.id,
        categoryId: familyCategory.id,
        sendHour: 17,
        sendMinute: 43,
        smsEnabled: true,
        smsTemplateId: template.id,
      },
    });

    await generateOccasionQueue(
      org.organization.id,
      birthday.id,
      { templateId: template.id, targetDate: todayIso },
      {
        categoryRules: [
          { categoryId: friendsCategory.id, sendHour: 18, sendMinute: 15, templateId: template.id },
          { categoryId: familyCategory.id, sendHour: 17, sendMinute: 43, templateId: template.id },
        ],
        skipSendTimeGate: true,
      },
    );

    const summary = await getDashboardHomeSummary(org.organization.id, UserRole.ADMIN);

    expect(summary.upcomingToday.items).toHaveLength(2);
    expect(summary.upcomingToday.items[0]).toMatchObject({
      contactName: earlierContact.name,
      timeLabel: "5:43 PM",
      occasionLabel: "Birthday",
      channel: "SMS",
      channelLabel: "SMS",
      status: "PENDING",
    });
    expect(summary.upcomingToday.items[1]).toMatchObject({
      contactName: laterContact.name,
      timeLabel: "6:15 PM",
    });
    expect(summary.upcomingToday.totalCount).toBe(2);
    expect(summary.upcomingToday.viewAllHref).toBe(
      `/dashboard/activity?status=pending&date=${todayIso}`,
    );

    await cleanupOrganization(org.organization.id);
  });

  it("excludes messages scheduled for a future date (3)", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const { org, birthday, todayIso } = await setupOrgWithTodayBirthday();
    const template = await createTemplate(org.organization.id, {
      name: "Birthday SMS",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
    });
    await prisma.categoryAutomationRule.create({
      data: {
        organizationId: org.organization.id,
        occasionId: birthday.id,
        categoryId: null,
        sendHour: 9,
        sendMinute: 0,
        smsEnabled: true,
        smsTemplateId: template.id,
      },
    });

    const futureDate = parseTargetDate(todayIso);
    const future = new Date(futureDate.date);
    future.setUTCDate(future.getUTCDate() + 5);
    const futureIso = future.toISOString().slice(0, 10);

    const contact = await createContact(org.organization.id, {
      name: "Future Person",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: `1990-${futureIso.slice(5)}` },
      isActive: true,
    });

    await generateOccasionQueue(
      org.organization.id,
      birthday.id,
      { templateId: template.id, targetDate: futureIso },
      { skipSendTimeGate: true },
    );

    const futureRow = await prisma.sendQueue.findFirst({
      where: { organizationId: org.organization.id, contactId: contact.id },
    });
    expect(futureRow).not.toBeNull();

    const summary = await getDashboardHomeSummary(org.organization.id, UserRole.ADMIN);
    expect(summary.upcomingToday.items).toHaveLength(0);
    expect(summary.upcomingToday.totalCount).toBe(0);

    await cleanupOrganization(org.organization.id);
  });

  it("excludes already-sent and permanently-failed messages (4, 5)", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const { org, birthday, todayIso } = await setupOrgWithTodayBirthday();
    const birthdayDate = birthdayDateForTodayMonthDay(todayIso);
    const template = await createTemplate(org.organization.id, {
      name: "Birthday SMS",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
    });
    await prisma.categoryAutomationRule.create({
      data: {
        organizationId: org.organization.id,
        occasionId: birthday.id,
        categoryId: null,
        sendHour: 9,
        sendMinute: 0,
        smsEnabled: true,
        smsTemplateId: template.id,
      },
    });

    const sentContact = await createContact(org.organization.id, {
      name: "Already Sent",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: birthdayDate },
      isActive: true,
    });
    const failedContact = await createContact(org.organization.id, {
      name: "Permanently Failed",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: birthdayDate },
      isActive: true,
    });
    const pendingContact = await createContact(org.organization.id, {
      name: "Still Pending",
      mobile: testMobile(),
      occasionDates: { [birthday.id]: birthdayDate },
      isActive: true,
    });

    await generateOccasionQueue(
      org.organization.id,
      birthday.id,
      { templateId: template.id, targetDate: todayIso },
      { skipSendTimeGate: true },
    );

    await prisma.sendQueue.updateMany({
      where: { organizationId: org.organization.id, contactId: sentContact.id },
      data: { status: QueueStatus.SENT, sentAt: new Date() },
    });
    await prisma.sendQueue.updateMany({
      where: { organizationId: org.organization.id, contactId: failedContact.id },
      data: { status: QueueStatus.FAILED, lastError: "boom", lastErrorCode: "TEST" },
    });

    const summary = await getDashboardHomeSummary(org.organization.id, UserRole.ADMIN);

    expect(summary.upcomingToday.items).toHaveLength(1);
    expect(summary.upcomingToday.items[0]?.contactName).toBe(pendingContact.name);
    expect(
      summary.upcomingToday.items.some((item) => item.contactName === sentContact.name),
    ).toBe(false);
    expect(
      summary.upcomingToday.items.some((item) => item.contactName === failedContact.name),
    ).toBe(false);

    await cleanupOrganization(org.organization.id);
  });

  it("previews at most 5 items but reports the real total count (7)", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const { org, birthday, todayIso } = await setupOrgWithTodayBirthday();
    const birthdayDate = birthdayDateForTodayMonthDay(todayIso);
    const template = await createTemplate(org.organization.id, {
      name: "Birthday SMS",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
    });
    await prisma.categoryAutomationRule.create({
      data: {
        organizationId: org.organization.id,
        occasionId: birthday.id,
        categoryId: null,
        sendHour: 9,
        sendMinute: 0,
        smsEnabled: true,
        smsTemplateId: template.id,
      },
    });

    for (let i = 0; i < 7; i += 1) {
      await createContact(org.organization.id, {
        name: `Person ${i}`,
        mobile: testMobile(),
        occasionDates: { [birthday.id]: birthdayDate },
        isActive: true,
      });
    }

    await generateOccasionQueue(
      org.organization.id,
      birthday.id,
      { templateId: template.id, targetDate: todayIso },
      { skipSendTimeGate: true },
    );

    const summary = await getDashboardHomeSummary(org.organization.id, UserRole.ADMIN);

    expect(summary.upcomingToday.items).toHaveLength(5);
    expect(summary.upcomingToday.totalCount).toBe(7);

    await cleanupOrganization(org.organization.id);
  });

  it("isolates upcoming messages per organization (8)", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const orgA = await setupOrgWithTodayBirthday();
    const orgB = await setupOrgWithTodayBirthday();
    const birthdayDateA = birthdayDateForTodayMonthDay(orgA.todayIso);

    const templateA = await createTemplate(orgA.org.organization.id, {
      name: "Birthday SMS",
      occasionId: orgA.birthday.id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
    });
    await prisma.categoryAutomationRule.create({
      data: {
        organizationId: orgA.org.organization.id,
        occasionId: orgA.birthday.id,
        categoryId: null,
        sendHour: 9,
        sendMinute: 0,
        smsEnabled: true,
        smsTemplateId: templateA.id,
      },
    });
    await createContact(orgA.org.organization.id, {
      name: "Org A Person",
      mobile: testMobile(),
      occasionDates: { [orgA.birthday.id]: birthdayDateA },
      isActive: true,
    });
    await generateOccasionQueue(
      orgA.org.organization.id,
      orgA.birthday.id,
      { templateId: templateA.id, targetDate: orgA.todayIso },
      { skipSendTimeGate: true },
    );

    const summaryB = await getDashboardHomeSummary(orgB.org.organization.id, UserRole.ADMIN);
    expect(summaryB.upcomingToday.items).toHaveLength(0);
    expect(summaryB.upcomingToday.totalCount).toBe(0);

    const summaryA = await getDashboardHomeSummary(orgA.org.organization.id, UserRole.ADMIN);
    expect(summaryA.upcomingToday.items).toHaveLength(1);

    await cleanupOrganization(orgA.org.organization.id);
    await cleanupOrganization(orgB.org.organization.id);
  });

  it("returns an empty upcoming list when nothing is scheduled today (9)", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const { org } = await setupOrgWithTodayBirthday();

    const summary = await getDashboardHomeSummary(org.organization.id, UserRole.ADMIN);

    expect(summary.upcomingToday.items).toEqual([]);
    expect(summary.upcomingToday.totalCount).toBe(0);

    await cleanupOrganization(org.organization.id);
  });

  it("falls back to the row's own timestamp when no category rule applies (manual-send style rows)", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, birthday, todayIso } = await setupOrgWithTodayBirthday();
    const template = await createTemplate(org.organization.id, {
      name: "Birthday SMS",
      occasionId: birthday.id,
      channel: "SMS",
      body: "Happy Birthday {{name}}!",
      isActive: true,
    });
    const contact = await createContact(org.organization.id, {
      name: "Manual Send Person",
      mobile: testMobile(),
      isActive: true,
    });

    await prisma.sendQueue.create({
      data: {
        organizationId: org.organization.id,
        contactId: contact.id,
        recipientName: contact.name,
        recipientMobile: contact.mobile,
        templateId: template.id,
        channel: Channel.SMS,
        occasionId: birthday.id,
        scheduledDate: parseTargetDate(todayIso).date,
        renderedBody: "Happy Birthday!",
        status: QueueStatus.PENDING,
        idempotencyKey: `manual-send:test:${contact.id}`,
      },
    });

    const summary = await getDashboardHomeSummary(org.organization.id, UserRole.ADMIN);

    expect(summary.upcomingToday.items).toHaveLength(1);
    expect(summary.upcomingToday.items[0]?.contactName).toBe("Manual Send Person");
    expect(summary.upcomingToday.items[0]?.timeLabel).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);

    await cleanupOrganization(org.organization.id);
  });
});
