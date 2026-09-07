import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

export const PLATFORM_ADMIN_AUDIT_ACTIONS = {
  ORGANIZATION_UPDATED: "ORGANIZATION_UPDATED",
  USER_ACTIVATED: "ORGANIZATION_USER_ACTIVATED",
  USER_DEACTIVATED: "ORGANIZATION_USER_DEACTIVATED",
  PASSWORD_RESET_REQUESTED: "ORGANIZATION_USER_PASSWORD_RESET_REQUESTED",
  VENDOR_CREATED: "VENDOR_CREATED",
  VENDOR_INVITE_SENT: "VENDOR_INVITE_SENT",
  VENDOR_REGISTRATION_SUBMITTED: "VENDOR_REGISTRATION_SUBMITTED",
  VENDOR_APPROVED: "VENDOR_APPROVED",
  VENDOR_REJECTED: "VENDOR_REJECTED",
  VENDOR_UPDATED: "VENDOR_UPDATED",
  QUEUE_RETRY_SCHEDULED: "QUEUE_RETRY_SCHEDULED",
  PLAN_ACTIVATED_DIRECT: "PLAN_ACTIVATED_DIRECT",
  PLAN_PAYMENT_RECORDED: "PLAN_PAYMENT_RECORDED",
  PAYMENT_LINK_CREATED: "PAYMENT_LINK_CREATED",
  PAYMENT_LINK_CANCELLED: "PAYMENT_LINK_CANCELLED",
  CUSTOM_PLAN_CHANNEL_TOPPED_UP: "CUSTOM_PLAN_CHANNEL_TOPPED_UP",
  PLAN_CATALOGUE_ENTRY_UPDATED: "PLAN_CATALOGUE_ENTRY_UPDATED",
} as const;

export type PlatformAdminAuditAction =
  (typeof PLATFORM_ADMIN_AUDIT_ACTIONS)[keyof typeof PLATFORM_ADMIN_AUDIT_ACTIONS];

export type PlatformAdminAuditTargetType =
  | "organization"
  | "organization_user"
  | "vendor"
  | "send_queue"
  | "plan_catalogue";

const ALLOWED_VALUE_KEYS = new Set([
  "isActive",
  "liveChannelsApproved",
  "timezone",
  "plan",
  "subscriptionStatus",
  "contactLimit",
  "monthlyMessageLimit",
  "dealSmsLimit",
  "dealWhatsappLimit",
  "dealEmailLimit",
  "messagesSentThisMonth",
  "name",
  "referralCode",
  "status",
  "nextAttemptAt",
  "label",
  "description",
  "amountPaise",
]);

const ALLOWED_METADATA_KEYS = new Set([
  "changedFields",
  "confirmedAmbiguousRetry",
  "dealId",
  "paymentId",
  "amountPaise",
  "checkoutId",
  "supersededCheckoutIds",
  "channel",
  "messagesAdded",
  "resultingMonthlyLimit",
  "plan",
]);

export type PlatformAdminAuditValues = Partial<{
  isActive: boolean;
  liveChannelsApproved: boolean;
  timezone: string;
  plan: string | null;
  subscriptionStatus: string | null;
  contactLimit: number | null;
  monthlyMessageLimit: number | null;
  dealSmsLimit: number | null;
  dealWhatsappLimit: number | null;
  dealEmailLimit: number | null;
  messagesSentThisMonth: number | null;
  name: string;
  referralCode: string;
  status: string;
  nextAttemptAt: string | null;
  label: string;
  description: string;
  amountPaise: number;
}>;

export type PlatformAdminAuditMetadata = Partial<{
  changedFields: string[];
  confirmedAmbiguousRetry: boolean;
  dealId: string;
  paymentId: string;
  amountPaise: number;
  checkoutId: string;
  supersededCheckoutIds: string[];
  channel: string;
  messagesAdded: number;
  resultingMonthlyLimit: number;
  plan: string;
}>;

export type CreatePlatformAdminAuditEventInput = {
  actorAdminId: string | null;
  organizationId?: string | null;
  action: PlatformAdminAuditAction;
  targetType: PlatformAdminAuditTargetType;
  targetId: string;
  before?: PlatformAdminAuditValues;
  after?: PlatformAdminAuditValues;
  metadata?: PlatformAdminAuditMetadata;
};

type AuditDb = Pick<Prisma.TransactionClient, "platformAdminAuditEvent">;

function toAllowlistedJson(
  value: Record<string, unknown> | undefined,
  allowedKeys: Set<string>,
): Prisma.InputJsonObject | undefined {
  if (!value) return undefined;

  const entries = Object.entries(value)
    .filter(([key, entry]) => allowedKeys.has(key) && entry !== undefined)
    .map(([key, entry]) => [
      key,
      key === "changedFields" && Array.isArray(entry)
        ? entry.filter(
            (field): field is string =>
              typeof field === "string" && ALLOWED_VALUE_KEYS.has(field),
          )
        : entry,
    ]);
  return entries.length === 0
    ? undefined
    : (Object.fromEntries(entries) as Prisma.InputJsonObject);
}

export async function createPlatformAdminAuditEvent(
  input: CreatePlatformAdminAuditEventInput,
  db: AuditDb = prisma,
) {
  return db.platformAdminAuditEvent.create({
    data: {
      actorAdminId: input.actorAdminId,
      organizationId: input.organizationId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      before: toAllowlistedJson(input.before, ALLOWED_VALUE_KEYS),
      after: toAllowlistedJson(input.after, ALLOWED_VALUE_KEYS),
      metadata: toAllowlistedJson(input.metadata, ALLOWED_METADATA_KEYS),
    },
  });
}

export type PlatformAdminAuditListItem = {
  id: string;
  createdAt: string;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string;
  before: Prisma.JsonValue | null;
  after: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
};

export async function listPlatformAdminAuditEventsForOrganization(
  organizationId: string,
  limit = 25,
): Promise<PlatformAdminAuditListItem[]> {
  const events = await prisma.platformAdminAuditEvent.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(Math.max(limit, 1), 100),
    select: {
      id: true,
      createdAt: true,
      action: true,
      targetType: true,
      targetId: true,
      before: true,
      after: true,
      metadata: true,
      actor: { select: { name: true } },
    },
  });

  return events.map((event) => ({
    id: event.id,
    createdAt: event.createdAt.toISOString(),
    actorName: event.actor?.name ?? null,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    before: event.before,
    after: event.after,
    metadata: event.metadata,
  }));
}

export async function listPlatformAdminAuditEventsForVendor(
  vendorId: string,
  limit = 25,
): Promise<PlatformAdminAuditListItem[]> {
  const events = await prisma.platformAdminAuditEvent.findMany({
    where: { targetType: "vendor", targetId: vendorId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(Math.max(limit, 1), 100),
    select: {
      id: true,
      createdAt: true,
      action: true,
      targetType: true,
      targetId: true,
      before: true,
      after: true,
      metadata: true,
      actor: { select: { name: true } },
    },
  });

  return events.map((event) => ({
    id: event.id,
    createdAt: event.createdAt.toISOString(),
    actorName: event.actor?.name ?? null,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    before: event.before,
    after: event.after,
    metadata: event.metadata,
  }));
}
