import {
  Channel,
  ChannelProvider,
  PrismaClient,
  QueueStatus,
} from "@prisma/client";
import { hash } from "bcryptjs";

import { TEST_PROVIDER_FAIL_MOBILE_SUFFIX } from "@/lib/queue/constants";

export const testPrisma = new PrismaClient();

export function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

let nextIndianMobileSeq = 9_870_000_000;

/** Unique valid 10-digit Indian mobile for tests. */
export function uniqueIndianMobile(): string {
  do {
    nextIndianMobileSeq += 1;
    if (nextIndianMobileSeq > 9_999_999_999) {
      nextIndianMobileSeq = 9_800_000_000;
    }
  } while (String(nextIndianMobileSeq).endsWith(TEST_PROVIDER_FAIL_MOBILE_SUFFIX));

  return String(nextIndianMobileSeq);
}

/** 10-digit mobile that triggers the test provider failure suffix. */
export function indianProviderFailMobile(): string {
  return `98${TEST_PROVIDER_FAIL_MOBILE_SUFFIX.padStart(8, "0")}`;
}

export async function createTestOrganization(suffix: string) {
  const passwordHash = await hash("password123", 12);
  const slug = `test-org-${suffix}-${Date.now()}`;

  const organization = await testPrisma.organization.create({
    data: {
      name: `Test Org ${suffix}`,
      slug,
      timezone: "UTC",
      subscription: {
        create: {
          contactLimit: 50,
          monthlyMessageLimit: 100,
        },
      },
      users: {
        create: {
          email: `admin-${suffix}-${Date.now()}@test.local`,
          passwordHash,
          name: "Test Admin",
        },
      },
      channelConfigs: {
        create: {
          channel: Channel.SMS,
          provider: ChannelProvider.TEST,
          encryptedCredentials: "test-credentials",
        },
      },
    },
  });

  const birthdayOccasion = await testPrisma.occasion.create({
    data: {
      organizationId: organization.id,
      name: "Birthday",
      isSystem: true,
    },
  });

  const contact = await testPrisma.contact.create({
    data: {
      organizationId: organization.id,
      name: "Test Contact",
      mobile: uniqueIndianMobile(),
    },
  });

  await testPrisma.contactOccasionDate.create({
    data: {
      organizationId: organization.id,
      contactId: contact.id,
      occasionId: birthdayOccasion.id,
      date: new Date(Date.UTC(2000, 6, 10)),
      month: 7,
      day: 10,
    },
  });

  await testPrisma.messageTemplate.create({
    data: {
      organizationId: organization.id,
      name: "Birthday SMS",
      occasionId: birthdayOccasion.id,
      channel: Channel.SMS,
      body: "Happy Birthday {{name}}!",
      variables: ["name"],
    },
  });

  return testPrisma.organization.findUniqueOrThrow({
    where: { id: organization.id },
    include: {
      users: true,
      contacts: true,
      messageTemplates: true,
    },
  });
}

export async function createSendQueueItem(
  organizationId: string,
  contactId: string,
  templateId: string,
  idempotencyKey: string,
) {
  const birthdayOccasion = await testPrisma.occasion.findFirstOrThrow({
    where: { organizationId, isSystem: true },
  });
  const contact = await testPrisma.contact.findUniqueOrThrow({
    where: { id: contactId },
    select: { name: true, mobile: true, email: true },
  });

  return testPrisma.sendQueue.create({
    data: {
      organizationId,
      contactId,
      recipientName: contact.name,
      recipientMobile: contact.mobile,
      recipientEmail: contact.email,
      templateId,
      channel: Channel.SMS,
      occasionId: birthdayOccasion.id,
      scheduledDate: new Date("2026-07-10"),
      renderedBody: "Happy Birthday Test Contact!",
      status: QueueStatus.PENDING,
      idempotencyKey,
    },
  });
}

export async function cleanupOrganization(organizationId: string) {
  await testPrisma.organization.delete({
    where: { id: organizationId },
  });
}
