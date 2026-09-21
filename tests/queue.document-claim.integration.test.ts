import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { QueueStatus } from "@prisma/client";

import { createRegisteredOrganization } from "@/lib/auth/register";
import { createContact } from "@/lib/contacts/service";
import { ensureSystemBirthdayOccasion } from "@/lib/occasions/service";
import { DOCUMENT_PREPARATION_GRACE_MS } from "@/lib/queue/constants";
import {
  claimQueueItemsForOrganization,
  listOrganizationsWithClaimableWork,
} from "@/lib/queue/claim";
import { createTemplate } from "@/lib/templates/service";
import { prisma } from "@/lib/db";
import { uniqueSuffix } from "./helpers";

const databaseUrl = process.env.DATABASE_URL;
let databaseAvailable = false;

function randomMobile(): string {
  return `9${Math.floor(Math.random() * 1e9).toString().padStart(9, "0")}`;
}

async function seedPdfQueueRow(options: { createdAt?: Date } = {}) {
  const suffix = uniqueSuffix();
  const org = await createRegisteredOrganization({
    organizationName: `Doc Claim ${suffix}`,
    organizationSlug: `doc-claim-${suffix}`,
    timezone: "Asia/Kolkata",
    adminName: "Owner",
    email: `doc-claim-${suffix}@test.local`,
    password: "password12345",
  });
  const organizationId = org.organization.id;
  const birthday = await ensureSystemBirthdayOccasion(organizationId);
  const template = await createTemplate(organizationId, {
    name: "Email with PDF",
    occasionId: birthday.id,
    channel: "EMAIL",
    emailSubject: "Happy Birthday",
    body: "Hello {{name}}!",
    isActive: true,
  });
  // The template requires a personalized PDF; no document template is needed
  // for exercising claim eligibility.
  await prisma.messageTemplate.update({
    where: { id: template.id },
    data: { includePersonalizedPdf: true },
  });
  const contact = await createContact(organizationId, {
    name: "Pdf Contact",
    mobile: randomMobile(),
    email: `pdf-${suffix}@test.local`,
    isActive: true,
  });
  const queue = await prisma.sendQueue.create({
    data: {
      organizationId,
      contactId: contact.id,
      recipientName: contact.name,
      recipientMobile: contact.mobile,
      recipientEmail: contact.email,
      templateId: template.id,
      channel: "EMAIL",
      occasionId: birthday.id,
      scheduledDate: new Date("2026-07-12"),
      renderedBody: "Hello",
      emailSubject: "Happy Birthday",
      status: QueueStatus.PENDING,
      idempotencyKey: `doc-claim:${suffix}`,
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    },
  });
  return { organizationId, queueId: queue.id };
}

describe("queue claiming with personalized PDFs", () => {
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

  it("does not claim a fresh row that is still waiting for its PDF", async ({ skip }) => {
    if (!databaseAvailable) skip();
    const { organizationId, queueId } = await seedPdfQueueRow();

    expect(await claimQueueItemsForOrganization(organizationId)).toEqual([]);
    expect(await listOrganizationsWithClaimableWork()).not.toContain(
      organizationId,
    );

    // The hold is specific to templates that need a PDF: once the template no
    // longer requires one, the same row is claimable immediately.
    await prisma.messageTemplate.updateMany({
      where: { organizationId },
      data: { includePersonalizedPdf: false },
    });
    const claimed = await claimQueueItemsForOrganization(organizationId);
    expect(claimed.map((row) => row.id)).toEqual([queueId]);

    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("claims a stale row anyway so it fails visibly instead of hanging", async ({
    skip,
  }) => {
    if (!databaseAvailable) skip();
    const { organizationId, queueId } = await seedPdfQueueRow({
      createdAt: new Date(Date.now() - DOCUMENT_PREPARATION_GRACE_MS - 60_000),
    });

    const claimed = await claimQueueItemsForOrganization(organizationId);
    expect(claimed.map((row) => row.id)).toEqual([queueId]);

    await prisma.organization.delete({ where: { id: organizationId } });
  });
});
