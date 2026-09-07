import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Channel, QueueStatus } from "@prisma/client";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { createContact } from "@/lib/contacts/service";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { claimQueueItemsForOrganization } from "@/lib/queue/claim";
import { sendQueueItem } from "@/lib/queue/send";
import { createTemplate } from "@/lib/templates/service";
import { updateTemplateSmsSetup } from "@/lib/templates/sms-setup";
import { prisma } from "@/lib/db";
import {
  buildSmsChannelConfigInput,
  TEST_CREDENTIALS_ENCRYPTION_KEY,
} from "./sms-test-helpers";
import {
  indianProviderFailMobile,
  uniqueIndianMobile as testMobile,
  uniqueSuffix,
} from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;


function registerInput(suffix: string) {
  return {
    organizationName: `Harden Org ${suffix}`,
    organizationSlug: `harden-org-${suffix}`,
    timezone: "UTC",
    adminName: "Harden Admin",
    email: `harden-admin-${suffix}@test.local`,
    password: "password12345",
  };
}

async function setupCustomHttpQueue(fetchImpl?: typeof fetch) {
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
    name: "Custom SMS",
    occasionId: birthday.id,
    channel: "SMS",
    body: "Hello {{name}}!",
    isActive: true,
  });

  await updateTemplateSmsSetup(org.organization.id, template.id, {
    dltTemplateId: "DLT-HARDEN",
    dltApprovedContent: "Hello {{name}}!",
  });

  const contact = await createContact(org.organization.id, {
    name: "Harden Person",
    mobile: "+919876543210",

    isActive: true,
  });

  const queue = await prisma.sendQueue.create({
    data: {
      organizationId: org.organization.id,
      contactId: contact.id,
      recipientName: contact.name,
      recipientMobile: contact.mobile,
      recipientEmail: contact.email,
      templateId: template.id,
      channel: "SMS",
      occasionId: birthday.id,
      scheduledDate: new Date("2026-07-12"),
      renderedBody: "Hello Harden Person!",
      status: QueueStatus.PENDING,
      idempotencyKey: `harden-${Date.now()}-${Math.random()}`,
    },
  });

  if (fetchImpl) {
    vi.stubGlobal("fetch", fetchImpl);
  }

  return { org, queue };
}

describe("hardening regressions", () => {
  beforeAll(async () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_CREDENTIALS_ENCRYPTION_KEY;
    if (!databaseUrl) return;
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

  it("does not auto-reclaim pre-send INVALID_PROVIDER_CONFIG failures", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const { org, queue } = await setupCustomHttpQueue();

    await prisma.channelConfig.update({
      where: {
        organizationId_channel: {
          organizationId: org.organization.id,
          channel: Channel.SMS,
        },
      },
      data: { encryptedCredentials: "not-valid-ciphertext" },
    });

    const first = await sendQueueItem(org.organization.id, queue.id);
    expect(first.status).toBe("failed");
    expect(first.errorCode).toBe("INVALID_PROVIDER_CONFIG");

    const afterFail = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: queue.id },
    });
    expect(afterFail.status).toBe(QueueStatus.FAILED);
    expect(afterFail.attemptCount).toBe(0);
    expect(afterFail.lastErrorCode).toBe("INVALID_PROVIDER_CONFIG");
    expect(afterFail.nextAttemptAt).toBeNull();

    expect(
      await claimQueueItemsForOrganization(org.organization.id),
    ).toEqual([]);

    const stillFailed = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: queue.id },
    });
    expect(stillFailed.status).toBe(QueueStatus.FAILED);
    expect(stillFailed.attemptCount).toBe(0);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("treats CUSTOM_HTTP HTTP 429 as ambiguous without auto-retry", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "rate limited",
    });
    const { org, queue } = await setupCustomHttpQueue(fetchMock as typeof fetch);

    const result = await sendQueueItem(org.organization.id, queue.id);
    expect(result.status).toBe("ambiguous");
    expect(result.errorCode).toBe("AMBIGUOUS_PROVIDER_OUTCOME");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const updated = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: queue.id },
    });
    expect(updated.lastErrorCode).toBe("AMBIGUOUS_PROVIDER_OUTCOME");
    expect(updated.nextAttemptAt).toBeNull();
    expect(updated.attemptCount).toBe(1);

    expect(
      await claimQueueItemsForOrganization(org.organization.id),
    ).toEqual([]);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });

  it("does not auto-retry CUSTOM_HTTP HTTP 4xx failures", async ({ skip }) => {
    if (!databaseAvailable) skip();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "forbidden",
    });
    const { org, queue } = await setupCustomHttpQueue(fetchMock as typeof fetch);

    const result = await sendQueueItem(org.organization.id, queue.id);
    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("PROVIDER_HTTP_4XX");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const updated = await prisma.sendQueue.findUniqueOrThrow({
      where: { id: queue.id },
    });
    expect(updated.nextAttemptAt).toBeNull();
    expect(updated.attemptCount).toBe(1);

    expect(
      await claimQueueItemsForOrganization(org.organization.id),
    ).toEqual([]);

    await prisma.organization.delete({ where: { id: org.organization.id } });
  });
});
