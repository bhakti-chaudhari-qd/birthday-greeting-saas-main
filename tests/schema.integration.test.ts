import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupOrganization,
  createSendQueueItem,
  createTestOrganization,
  uniqueIndianMobile as testMobile,
  testPrisma,
} from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

describe("database foundation", () => {
  beforeAll(async () => {
    if (!databaseUrl) {
      return;
    }

    try {
      await testPrisma.$connect();
      await testPrisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("connects to PostgreSQL", async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
    }

    const result = await testPrisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
    expect(result[0]?.ok).toBe(1);
  });

  it("enforces unique contact mobile per organization", async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
    }

    const org = await createTestOrganization("contact-unique");
    const contact = org.contacts[0];

    await expect(
      testPrisma.contact.create({
        data: {
          organizationId: org.id,
          name: "Duplicate Mobile",
          mobile: contact.mobile,
        },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);

    await cleanupOrganization(org.id);
  });

  it("allows the same mobile in different organizations", async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
    }

    const orgA = await createTestOrganization("contact-tenant-a");
    const orgB = await createTestOrganization("contact-tenant-b");
    const sharedMobile = testMobile();

    await testPrisma.contact.create({
      data: {
        organizationId: orgA.id,
        name: "Shared Mobile A",
        mobile: sharedMobile,
      },
    });

    await expect(
      testPrisma.contact.create({
        data: {
          organizationId: orgB.id,
          name: "Shared Mobile B",
          mobile: sharedMobile,
        },
      }),
    ).resolves.toBeDefined();

    await cleanupOrganization(orgA.id);
    await cleanupOrganization(orgB.id);
  });

  it("enforces queue idempotency per organization", async ({ skip }) => {
    if (!databaseAvailable) {
      skip();
    }

    const org = await createTestOrganization("queue-idempotency");
    const contact = org.contacts[0];
    const template = org.messageTemplates[0];
    const idempotencyKey = `queue-${Date.now()}`;

    await createSendQueueItem(
      org.id,
      contact.id,
      template.id,
      idempotencyKey,
    );

    await expect(
      createSendQueueItem(org.id, contact.id, template.id, idempotencyKey),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);

    await cleanupOrganization(org.id);
  });

  it("preserves delivery history by restricting send queue deletion", async ({
    skip,
  }) => {
    if (!databaseAvailable) {
      skip();
    }

    const org = await createTestOrganization("delivery-history");
    const contact = org.contacts[0];
    const template = org.messageTemplates[0];

    const queueItem = await createSendQueueItem(
      org.id,
      contact.id,
      template.id,
      `delivery-${Date.now()}`,
    );

    await testPrisma.deliveryLog.create({
      data: {
        organizationId: org.id,
        sendQueueId: queueItem.id,
        attemptNumber: 1,
      },
    });

    await expect(
      testPrisma.sendQueue.delete({ where: { id: queueItem.id } }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);

    await cleanupOrganization(org.id);
  });

  it("preserves queue history by restricting contact deletion", async ({
    skip,
  }) => {
    if (!databaseAvailable) {
      skip();
    }

    const org = await createTestOrganization("contact-restrict");
    const contact = org.contacts[0];
    const template = org.messageTemplates[0];

    await createSendQueueItem(
      org.id,
      contact.id,
      template.id,
      `contact-restrict-${Date.now()}`,
    );

    await expect(
      testPrisma.contact.delete({ where: { id: contact.id } }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);

    await cleanupOrganization(org.id);
  });
});
