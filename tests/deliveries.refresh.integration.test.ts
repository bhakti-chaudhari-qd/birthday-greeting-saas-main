import { Channel, ChannelProvider, DeliveryStatus, QueueStatus } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { upsertSmsChannelConfig } from "@/lib/channel-config/service";
import { createContact } from "@/lib/contacts/service";
import {
  DeliveryNotFoundError,
  DeliveryRefreshError,
} from "@/lib/deliveries/errors";
import { listDeliveries } from "@/lib/deliveries/list";
import { refreshDeliveryStatus } from "@/lib/deliveries/refresh";
import { getOrganizationLocalIsoDate } from "@/lib/queue/dates";
import { generateOccasionQueue } from "@/lib/queue/generate";
import { sendQueueItem } from "@/lib/queue/send";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { createTemplate } from "@/lib/templates/service";
import { updateTemplateSmsSetup } from "@/lib/templates/sms-setup";
import { prisma } from "@/lib/db";
import { buildSmsChannelConfigInput, TEST_CREDENTIALS_ENCRYPTION_KEY } from "./sms-test-helpers";
import { uniqueIndianMobile as testMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;



function registerInput(suffix: string, timezone = "UTC") {
  return {
    organizationName: `Delivery Refresh Org ${suffix}`,
    organizationSlug: `delivery-refresh-org-${suffix}`,
    timezone,
    adminName: "Refresh Admin",
    email: `delivery-refresh-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

function statusResponse(
  mobile: string,
  deliveryStatus: string,
  status = true,
  message = "Success",
) {
  return JSON.stringify({
    Status: status,
    Message: message,
    Response: [{ Mobile: mobile, DeliveryStatus: deliveryStatus }],
  });
}

async function setupSentDeliveryLog(options?: {
  fetchImpl?: typeof fetch;
  timezone?: string;
  providerMessageId?: string;
  useCustomHttp?: boolean;
}) {
  const org = await createRegisteredOrganization(
    registerInput(uniqueSuffix(), options?.timezone ?? "UTC"),
  );
  const birthday = await ensureSystemBirthdayOccasion(org.organization.id);

  if (options?.useCustomHttp !== false) {
    await prisma.channelConfig.create({
      data: {
        organizationId: org.organization.id,
        channel: Channel.SMS,
        ...buildSmsChannelConfigInput(),
      },
    });
  } else {
    await upsertSmsChannelConfig(org.organization.id, {
      provider: ChannelProvider.TEST,
      isActive: true,
    });
  }

  const template = await createTemplate(org.organization.id, {
    name: "Birthday SMS",
    occasionId: birthday.id,
    channel: "SMS",
    body: "Happy Birthday {{name}}!",
    isActive: true,
  });

  await updateTemplateSmsSetup(org.organization.id, template.id, {
    dltTemplateId: "DLT123456",
    dltApprovedContent: "Happy Birthday {{name}}!",
  });

  await prisma.categoryAutomationRule.create({
    data: {
      organizationId: org.organization.id,
      occasionId: birthday.id,
      categoryId: null,
      sendHour: 0,
      sendMinute: 0,
      smsEnabled: true,
      smsTemplateId: template.id,
    },
  });

  const contact = await createContact(org.organization.id, {
    name: "Refresh Person",
    mobile: testMobile(),
    occasionDates: { [birthday.id]: "1990-07-11" },

    isActive: true,
  });

  await generateOccasionQueue(org.organization.id, birthday.id, {
    templateId: template.id,
    targetDate: "2026-07-11",
  });

  const queue = await prisma.sendQueue.findFirstOrThrow({
    where: { organizationId: org.organization.id, contactId: contact.id },
  });

  if (options?.fetchImpl) {
    vi.stubGlobal("fetch", options.fetchImpl);
  }

  const sendResult = await sendQueueItem(org.organization.id, queue.id);
  expect(sendResult.status).toBe("sent");

  const log = await prisma.deliveryLog.findFirstOrThrow({
    where: { sendQueueId: queue.id },
  });

  if (options?.providerMessageId) {
    await prisma.deliveryLog.update({
      where: { id: log.id },
      data: { providerMessageId: options.providerMessageId },
    });
  }

  return {
    org,
    contact,
    queue,
    log: await prisma.deliveryLog.findFirstOrThrow({ where: { id: log.id } }),
  };
}

describe("delivery status refresh", () => {
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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("refreshes SENT to DELIVERED and moves queue SENT to DELIVERED", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const mobile = testMobile();
    const org = await createRegisteredOrganization(registerInput(uniqueSuffix()));
    const birthday = await ensureSystemBirthdayOccasion(org.organization.id);
    await prisma.channelConfig.create({
      data: {
        organizationId: org.organization.id,
        channel: Channel.SMS,
        ...buildSmsChannelConfigInput(),
      },
    });
  const template = await createTemplate(org.organization.id, {
    name: "Birthday SMS",
    occasionId: birthday.id,
    channel: "SMS",
    body: "Happy Birthday {{name}}!",
    isActive: true,
  });

  await updateTemplateSmsSetup(org.organization.id, template.id, {
    dltTemplateId: "DLT123456",
    dltApprovedContent: "Happy Birthday {{name}}!",
  });

  await prisma.categoryAutomationRule.create({
    data: {
      organizationId: org.organization.id,
      occasionId: birthday.id,
      categoryId: null,
      sendHour: 0,
      sendMinute: 0,
      smsEnabled: true,
      smsTemplateId: template.id,
    },
  });
    const contact = await createContact(org.organization.id, {
      name: "Delivered Person",
      mobile,
      occasionDates: { [birthday.id]: "1990-07-11" },

      isActive: true,
    });
    await generateOccasionQueue(org.organization.id, birthday.id, {
      templateId: template.id,
      targetDate: "2026-07-11",
    });
    const queue = await prisma.sendQueue.findFirstOrThrow({
      where: { organizationId: org.organization.id, contactId: contact.id },
    });

    const sendFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "1|1|provider-delivered",
    });
    vi.stubGlobal("fetch", sendFetch as typeof fetch);
    await sendQueueItem(org.organization.id, queue.id);

    const log = await prisma.deliveryLog.findFirstOrThrow({
      where: { sendQueueId: queue.id },
    });

    const statusFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        statusResponse(mobile.replace("+", ""), "DELIVRD"),
    });
    vi.stubGlobal("fetch", statusFetch as typeof fetch);

    const result = await refreshDeliveryStatus(org.organization.id, log.id);

    expect(result.result).toBe("refreshed");
    expect(result.status).toBe(DeliveryStatus.DELIVERED);
    expect(result.queueStatus).toBe(QueueStatus.DELIVERED);

    const storedLog = await prisma.deliveryLog.findUniqueOrThrow({
      where: { id: log.id },
    });
    const storedQueue = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: queue.id },
    });
    expect(storedLog.status).toBe(DeliveryStatus.DELIVERED);
    expect(storedQueue.status).toBe(QueueStatus.DELIVERED);
    expect(storedQueue.attemptCount).toBe(1);
    expect(
      (storedLog.providerResponse as { provider?: string }).provider,
    ).toBe("CUSTOM_HTTP");
    expect(
      (storedLog.providerResponse as { deliveryStatus?: { outcome?: string } })
        .deliveryStatus?.outcome,
    ).toBe("delivered");

    const requestedUrl = String(statusFetch.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("msgid=provider-delivered");
    expect(requestedUrl).toContain(
      `date=${getOrganizationLocalIsoDate("UTC", storedQueue.sentAt!)}`,
    );

    await cleanupOrganization(org.organization.id);
  });

  it("marks blocked outcomes as UNDELIVERED while keeping queue SENT", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, contact, queue, log } = await setupSentDeliveryLog({
      fetchImpl: vi.fn()
        .mockResolvedValueOnce({ ok: true, text: async () => "1|1|blocked-1" })
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            statusResponse(
              contact.mobile.replace("+", ""),
              "FULLY BLOCKED or PROMO BLOCKED",
            ),
        }) as typeof fetch,
    });

    const result = await refreshDeliveryStatus(org.organization.id, log.id);

    expect(result.status).toBe(DeliveryStatus.UNDELIVERED);
    expect(result.queueStatus).toBe(QueueStatus.SENT);

    const storedQueue = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: queue.id },
    });
    expect(storedQueue.status).toBe(QueueStatus.SENT);

    await cleanupOrganization(org.organization.id);
  });

  it("keeps SENT for pending and unknown provider outcomes", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const pending = await setupSentDeliveryLog({
      providerMessageId: "test-key-1-ds-pending",
      useCustomHttp: false,
    });
    const pendingResult = await refreshDeliveryStatus(
      pending.org.organization.id,
      pending.log.id,
    );
    expect(pendingResult.status).toBe(DeliveryStatus.SENT);
    expect(pendingResult.providerOutcome).toBe("pending");

    const unknown = await setupSentDeliveryLog({
      providerMessageId: "test-key-1-ds-unknown",
      useCustomHttp: false,
    });
    const unknownResult = await refreshDeliveryStatus(
      unknown.org.organization.id,
      unknown.log.id,
    );
    expect(unknownResult.status).toBe(DeliveryStatus.SENT);
    expect(unknownResult.providerOutcome).toBe("unknown");

    await cleanupOrganization(pending.org.organization.id);
    await cleanupOrganization(unknown.org.organization.id);
  });

  it("leaves persistence unchanged when provider lookup fails", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, log } = await setupSentDeliveryLog({
      fetchImpl: vi.fn()
        .mockResolvedValueOnce({ ok: true, text: async () => "1|1|lookup-fail" })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => "not-json",
        }) as typeof fetch,
    });

    await expect(
      refreshDeliveryStatus(org.organization.id, log.id),
    ).rejects.toBeInstanceOf(DeliveryRefreshError);

    const stored = await prisma.deliveryLog.findUniqueOrThrow({
      where: { id: log.id },
    });
    expect(stored.status).toBe(DeliveryStatus.SENT);

    await cleanupOrganization(org.organization.id);
  });

  it("prevents cross-tenant refresh access", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const { org, log } = await setupSentDeliveryLog({
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "1|1|tenant-safe",
      }) as typeof fetch,
    });
    const other = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    await expect(
      refreshDeliveryStatus(other.organization.id, log.id),
    ).rejects.toBeInstanceOf(DeliveryNotFoundError);

    await cleanupOrganization(org.organization.id);
    await cleanupOrganization(other.organization.id);
  });

  it("rejects logs without providerMessageId and ineligible statuses", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, queue } = await setupSentDeliveryLog({
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "1|1|missing-id",
      }) as typeof fetch,
    });

    const log = await prisma.deliveryLog.findFirstOrThrow({
      where: { sendQueueId: queue.id },
    });

    await prisma.deliveryLog.update({
      where: { id: log.id },
      data: { providerMessageId: null },
    });

    await expect(
      refreshDeliveryStatus(org.organization.id, log.id),
    ).rejects.toMatchObject({ code: "MISSING_PROVIDER_MESSAGE_ID" });

    await prisma.deliveryLog.update({
      where: { id: log.id },
      data: { providerMessageId: "missing-id", status: DeliveryStatus.FAILED },
    });

    await expect(
      refreshDeliveryStatus(org.organization.id, log.id),
    ).rejects.toMatchObject({ code: "INELIGIBLE_DELIVERY_STATUS" });

    await cleanupOrganization(org.organization.id);
  });

  it("returns idempotent results for terminal delivery logs without provider calls", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, log } = await setupSentDeliveryLog({
      providerMessageId: "test-key-1-ds-delivered",
      useCustomHttp: false,
    });

    await prisma.deliveryLog.update({
      where: { id: log.id },
      data: { status: DeliveryStatus.DELIVERED },
    });

    const deliveredResult = await refreshDeliveryStatus(
      org.organization.id,
      log.id,
    );
    expect(deliveredResult.result).toBe("already_terminal");

    await prisma.deliveryLog.update({
      where: { id: log.id },
      data: { status: DeliveryStatus.UNDELIVERED },
    });

    const undeliveredResult = await refreshDeliveryStatus(
      org.organization.id,
      log.id,
    );
    expect(undeliveredResult.result).toBe("already_terminal");

    await cleanupOrganization(org.organization.id);
  });

  it("does not create new delivery logs or increment attemptCount", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, queue, log } = await setupSentDeliveryLog({
      providerMessageId: "test-key-1-ds-delivered",
      useCustomHttp: false,
    });

    await refreshDeliveryStatus(org.organization.id, log.id);

    const logs = await listDeliveries(org.organization.id, {
      page: 1,
      limit: 10,
      sendQueueId: queue.id,
    });
    expect(logs.data).toHaveLength(1);

    const storedQueue = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: queue.id },
    });
    expect(storedQueue.attemptCount).toBe(1);

    await cleanupOrganization(org.organization.id);
  });

  it("formats submission date using organization timezone", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, contact, log } = await setupSentDeliveryLog({
      timezone: "Asia/Kolkata",
      fetchImpl: vi.fn()
        .mockResolvedValueOnce({ ok: true, text: async () => "1|1|tz-test" })
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            statusResponse(contact.mobile.replace("+", ""), "DELIVRD"),
        }) as typeof fetch,
    });

    await prisma.sendQueue.update({
      where: { id: log.sendQueueId },
      data: { sentAt: new Date("2026-07-10T20:30:00.000Z") },
    });

    await refreshDeliveryStatus(org.organization.id, log.id);

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const statusCallUrl = String(
      fetchMock.mock.calls[fetchMock.mock.calls.length - 1]?.[0],
    );
    expect(statusCallUrl).toContain("date=2026-07-11");

    await cleanupOrganization(org.organization.id);
  });

  it("does not regress terminal delivery state during concurrent refresh", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, log } = await setupSentDeliveryLog({
      providerMessageId: "test-key-1-ds-delivered",
      useCustomHttp: false,
    });

    await prisma.deliveryLog.update({
      where: { id: log.id },
      data: { status: DeliveryStatus.DELIVERED },
    });

    const result = await refreshDeliveryStatus(org.organization.id, log.id);
    expect(result.result).toBe("already_terminal");
    expect(result.status).toBe(DeliveryStatus.DELIVERED);

    await cleanupOrganization(org.organization.id);
  });

  it("rejects refresh when organization timezone is invalid before provider call", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, log } = await setupSentDeliveryLog({
      providerMessageId: "test-key-1-ds-delivered",
      useCustomHttp: false,
    });

    await prisma.organization.update({
      where: { id: org.organization.id },
      data: { timezone: "Not/A_Timezone" },
    });

    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy as typeof fetch);

    await expect(
      refreshDeliveryStatus(org.organization.id, log.id),
    ).rejects.toMatchObject({ code: "INVALID_ORGANIZATION_TIMEZONE" });

    expect(fetchSpy).not.toHaveBeenCalled();

    const stored = await prisma.deliveryLog.findUniqueOrThrow({
      where: { id: log.id },
    });
    expect(stored.status).toBe(DeliveryStatus.SENT);

    await cleanupOrganization(org.organization.id);
  });

  it("does not mark delivery DELIVERED when queue is in an incompatible state", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, contact, queue, log } = await setupSentDeliveryLog({
      fetchImpl: vi.fn()
        .mockResolvedValueOnce({ ok: true, text: async () => "1|1|queue-fail" })
        .mockResolvedValueOnce({
          ok: true,
          text: async () =>
            statusResponse(contact.mobile.replace("+", ""), "DELIVRD"),
        }) as typeof fetch,
    });

    await prisma.sendQueue.update({
      where: { id: queue.id },
      data: { status: QueueStatus.FAILED },
    });

    await expect(
      refreshDeliveryStatus(org.organization.id, log.id),
    ).rejects.toMatchObject({ code: "INELIGIBLE_QUEUE_STATUS" });

    const storedLog = await prisma.deliveryLog.findUniqueOrThrow({
      where: { id: log.id },
    });
    const storedQueue = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: queue.id },
    });
    expect(storedLog.status).toBe(DeliveryStatus.SENT);
    expect(storedQueue.status).toBe(QueueStatus.FAILED);

    await cleanupOrganization(org.organization.id);
  });

  it("does not overwrite terminal delivery logs with pending metadata", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, log } = await setupSentDeliveryLog({
      providerMessageId: "test-key-1-ds-pending",
      useCustomHttp: false,
    });

    await prisma.deliveryLog.update({
      where: { id: log.id },
      data: { status: DeliveryStatus.UNDELIVERED },
    });

    const result = await refreshDeliveryStatus(org.organization.id, log.id);
    expect(result.result).toBe("already_terminal");
    expect(result.status).toBe(DeliveryStatus.UNDELIVERED);

    await cleanupOrganization(org.organization.id);
  });

  it("returns unchanged default test-provider outcome for generic provider message IDs", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, queue, log } = await setupSentDeliveryLog({
      useCustomHttp: false,
    });

    const result = await refreshDeliveryStatus(org.organization.id, log.id);

    expect(result.result).toBe("unchanged");
    expect(result.status).toBe(DeliveryStatus.SENT);
    expect(result.providerOutcome).toBe("unknown");

    const storedQueue = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: queue.id },
    });
    expect(storedQueue.status).toBe(QueueStatus.SENT);

    await cleanupOrganization(org.organization.id);
  });
});
