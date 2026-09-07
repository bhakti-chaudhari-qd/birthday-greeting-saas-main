import { Channel } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { createContact } from "@/lib/contacts/service";
import { listDeliveries } from "@/lib/deliveries/list";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { QueueNotFoundError } from "@/lib/queue/errors";
import { generateOccasionQueue } from "@/lib/queue/generate";
import { sendQueueItem } from "@/lib/queue/send";
import { createTemplate } from "@/lib/templates/service";
import { updateTemplateSmsSetup } from "@/lib/templates/sms-setup";
import { prisma } from "@/lib/db";
import { buildSmsChannelConfigInput, TEST_CREDENTIALS_ENCRYPTION_KEY } from "./sms-test-helpers";
import { uniqueIndianMobile as testMobile, indianProviderFailMobile, uniqueSuffix } from "./helpers";


const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;



function registerInput(suffix: string) {
  return {
    organizationName: `SMS Provider Org ${suffix}`,
    organizationSlug: `sms-provider-org-${suffix}`,
    timezone: "UTC",
    adminName: "SMS Admin",
    email: `sms-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

async function cleanupOrganization(organizationId: string) {
  await prisma.organization.delete({ where: { id: organizationId } });
}

async function setupSmsProviderOrg(options?: {
  fetchImpl?: typeof fetch;
  configureDlt?: boolean;
}) {
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

  if (options?.configureDlt !== false) {
    await updateTemplateSmsSetup(org.organization.id, template.id, {
      dltTemplateId: "DLT123456",
      dltApprovedContent: "Happy Birthday {{name}}!",
    });
  }

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
    name: "SMS Person",
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

  return { org, template, contact, queue };
}

describe("real SMS provider send pipeline", () => {
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

  it("sends through CUSTOM_HTTP provider and persists provider SMS ID", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "1|1|987654321",
    });

    const { org, queue } = await setupSmsProviderOrg({
      fetchImpl: fetchImpl as typeof fetch,
    });
    const result = await sendQueueItem(org.organization.id, queue.id);

    expect(result.status).toBe("sent");
    expect(result.queue?.status).toBe("SENT");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const requestedUrl = String(fetchImpl.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("templateid=DLT123456");
    expect(requestedUrl).toContain("pass=");

    const logs = await listDeliveries(org.organization.id, {
      page: 1,
      limit: 10,
      sendQueueId: queue.id,
    });
    expect(logs.data[0]?.provider).toBe("CUSTOM_HTTP");
    expect(logs.data[0]?.providerMessageId).toBe("987654321");

    await cleanupOrganization(org.organization.id);
  });

  it("does not mark queue SENT when provider rejects submission", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "2",
    }) as typeof fetch;

    const { org, queue } = await setupSmsProviderOrg({ fetchImpl });
    const result = await sendQueueItem(org.organization.id, queue.id);

    expect(result.status).toBe("failed");
    expect(result.queue?.status).toBe("FAILED");
    expect(result.error).toBe("Invalid SMS provider credentials");

    const logs = await listDeliveries(org.organization.id, {
      page: 1,
      limit: 10,
      sendQueueId: queue.id,
    });
    expect(logs.data[0]?.status).toBe("FAILED");
    expect(logs.data[0]?.errorMessage).toBe(
      "Invalid SMS provider credentials",
    );

    await cleanupOrganization(org.organization.id);
  });

  it("fails safely when SMS template is not ready for real SMS", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const fetchImpl = vi.fn() as typeof fetch;
    const { org, queue } = await setupSmsProviderOrg({
      fetchImpl,
      configureDlt: false,
    });

    const result = await sendQueueItem(org.organization.id, queue.id);

    expect(result.status).toBe("failed");
    expect(result.error).toBe("DLT Template ID is required for real SMS");
    expect(fetchImpl).not.toHaveBeenCalled();

    await cleanupOrganization(org.organization.id);
  });

  it("fails safely when application body is incompatible with approved DLT content", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const fetchImpl = vi.fn() as typeof fetch;
    const { org, queue, template } = await setupSmsProviderOrg({
      fetchImpl,
    });

    await prisma.messageTemplate.update({
      where: { id: template.id },
      data: { body: "Hi {{name}}!" },
    });

    const result = await sendQueueItem(org.organization.id, queue.id);

    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/compatible|static text/i);
    expect(fetchImpl).not.toHaveBeenCalled();

    await cleanupOrganization(org.organization.id);
  });

  it("fails safely when rendered body does not match approved DLT structure", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const fetchImpl = vi.fn() as typeof fetch;
    const { org, queue } = await setupSmsProviderOrg({
      fetchImpl,
    });

    await prisma.sendQueue.update({
      where: { id: queue.id },
      data: { renderedBody: "Happy Anniversary SMS Person!" },
    });

    const result = await sendQueueItem(org.organization.id, queue.id);

    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/Rendered message does not match/i);
    expect(fetchImpl).not.toHaveBeenCalled();

    await cleanupOrganization(org.organization.id);
  });

  it("prevents cross-tenant send access with real provider configured", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "1|1|123",
    }) as typeof fetch;

    const { org, queue } = await setupSmsProviderOrg({ fetchImpl });
    const other = await createRegisteredOrganization(registerInput(uniqueSuffix()));

    await expect(
      sendQueueItem(other.organization.id, queue.id),
    ).rejects.toBeInstanceOf(QueueNotFoundError);

    await cleanupOrganization(org.organization.id);
    await cleanupOrganization(other.organization.id);
  });
});
