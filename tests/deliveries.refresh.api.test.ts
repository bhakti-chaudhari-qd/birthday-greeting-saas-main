import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ChannelProvider } from "@prisma/client";

import { POST as refreshDeliveryRoute } from "@/app/api/v1/deliveries/[id]/refresh/route";
import  { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createRegisteredOrganization } from "@/lib/auth/register";
import { createSessionRecord } from "@/lib/auth/session";
import { upsertSmsChannelConfig } from "@/lib/channel-config/service";
import { createContact } from "@/lib/contacts/service";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { generateOccasionQueue } from "@/lib/queue/generate";
import { sendQueueItem } from "@/lib/queue/send";
import { createTemplate } from "@/lib/templates/service";
import { prisma } from "@/lib/db";
import { TEST_CREDENTIALS_ENCRYPTION_KEY } from "./sms-test-helpers";
import { uniqueSuffix } from "./helpers";


vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;


function registerInput(suffix: string) {
  return {
    organizationName: `Delivery API Org ${suffix}`,
    organizationSlug: `delivery-api-org-${suffix}`,
    timezone: "UTC",
    adminName: "API Admin",
    email: `delivery-api-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

async function mockSessionCookie(rawToken: string) {
  const { cookies } = await import("next/headers");

  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME ? { value: rawToken } : undefined,
    set: vi.fn(),
  } as unknown as Awaited<ReturnType<typeof cookies>>);
}

async function setupBirthdayQueueItem(organizationId: string, mobile: string) {
  await upsertSmsChannelConfig(organizationId, {
    provider: ChannelProvider.TEST,
    isActive: true,
  });
  const birthday = await ensureSystemBirthdayOccasion(organizationId);
  const template = await createTemplate(organizationId, {
    name: "Birthday SMS",
    occasionId: birthday.id,
    channel: "SMS",
    body: "Happy Birthday {{name}}!",
    isActive: true,
  });
  await prisma.categoryAutomationRule.create({
    data: {
      organizationId,
      occasionId: birthday.id,
      categoryId: null,
      sendHour: 0,
      sendMinute: 0,
      smsEnabled: true,
      smsTemplateId: template.id,
    },
  });
  const contact = await createContact(organizationId, {
    name: "API Person",
    mobile,
    occasionDates: { [birthday.id]: "1990-07-11" },

    isActive: true,
  });
  await generateOccasionQueue(organizationId, birthday.id, {
    templateId: template.id,
    targetDate: "2026-07-11",
  });
  return prisma.sendQueue.findFirstOrThrow({
    where: { organizationId, contactId: contact.id },
  });
}

describe("delivery refresh API route", () => {
  beforeAll(async () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_CREDENTIALS_ENCRYPTION_KEY;

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

  it("rejects unauthenticated refresh requests", async () => {
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
      set: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof cookies>>);

    const response = await refreshDeliveryRoute(
      new Request("http://localhost/api/v1/deliveries/log-1/refresh", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "log-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns refreshed delivery data for an authenticated tenant", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const queue = await setupBirthdayQueueItem(org.organization.id, "9876543210");
    await sendQueueItem(org.organization.id, queue.id);

    const log = await prisma.deliveryLog.findFirstOrThrow({
      where: { sendQueueId: queue.id },
    });

    await prisma.deliveryLog.update({
      where: { id: log.id },
      data: { providerMessageId: "test-key-1-ds-delivered" },
    });

    const { rawToken } = await createSessionRecord(
      org.user.id,
      org.organization.id,
    );
    await mockSessionCookie(rawToken);

    const response = await refreshDeliveryRoute(
      new Request("http://localhost/api/v1/deliveries/log/refresh", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: log.id }) },
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.deliveryLogId).toBe(log.id);
    expect(body.data.status).toBe("DELIVERED");
    expect(JSON.stringify(body)).not.toContain("password");

    await cleanupOrganization(org.organization.id);
  });

  it("rejects cross-tenant refresh access with 404", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const other = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const queue = await setupBirthdayQueueItem(org.organization.id, "9876543211");
    await sendQueueItem(org.organization.id, queue.id);
    const log = await prisma.deliveryLog.findFirstOrThrow({
      where: { sendQueueId: queue.id },
    });

    const { rawToken } = await createSessionRecord(
      other.user.id,
      other.organization.id,
    );
    await mockSessionCookie(rawToken);

    const response = await refreshDeliveryRoute(
      new Request("http://localhost/api/v1/deliveries/log/refresh", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: log.id }) },
    );

    expect(response.status).toBe(404);

    await cleanupOrganization(org.organization.id);
    await cleanupOrganization(other.organization.id);
  });

  it("rejects invalid organization timezone with a safe API error", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const queue = await setupBirthdayQueueItem(org.organization.id, "9876543212");
    await sendQueueItem(org.organization.id, queue.id);
    const log = await prisma.deliveryLog.findFirstOrThrow({
      where: { sendQueueId: queue.id },
    });

    await prisma.organization.update({
      where: { id: org.organization.id },
      data: { timezone: "Not/A_Timezone" },
    });

    const { rawToken } = await createSessionRecord(
      org.user.id,
      org.organization.id,
    );
    await mockSessionCookie(rawToken);

    const response = await refreshDeliveryRoute(
      new Request("http://localhost/api/v1/deliveries/log/refresh", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: log.id }) },
    );

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("Organization timezone is invalid");
    expect(JSON.stringify(body)).not.toContain("password");

    await cleanupOrganization(org.organization.id);
  });
});
