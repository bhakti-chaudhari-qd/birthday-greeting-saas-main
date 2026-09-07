import { createHash, randomBytes } from "node:crypto";

import {
  Prisma,
  VendorOnboardingStatus,
  VendorRegistrationInviteDeliveryStatus,
} from "@prisma/client";
import { z } from "zod";

import { normalizeMobile } from "@/lib/contacts/mobile";
import { prisma } from "@/lib/db";
import {
  getPlatformSmsConfig,
  type PlatformSmsConfig,
} from "@/lib/env";
import { createLegacyHttpSmsProvider } from "@/lib/messaging/providers/sms/legacy-http-sms-provider";
import {
  ProviderSendError,
  type MessageProvider,
} from "@/lib/messaging/providers/types";
import {
  PLATFORM_ADMIN_AUDIT_ACTIONS,
  createPlatformAdminAuditEvent,
} from "@/lib/admin/audit";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PENDING_DISPATCH_LEASE_MS = 10 * 60 * 1000;
const MAX_ALLOCATION_ATTEMPTS = 12;
const INVITATION_VARIABLE_PATTERN =
  /\{\{(\w+)\}\}|\{#(\w+)#\}/g;

export const createPlatformVendorSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .refine((name) => !/[\u0000-\u001f\u007f]/.test(name), {
        message: "Vendor name must not contain control characters",
      }),
    mobile: z.string().trim().min(1).max(32),
  })
  .strict()
  .transform((input, context) => {
    try {
      return { ...input, mobile: normalizeMobile(input.mobile) };
    } catch (error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mobile"],
        message:
          error instanceof Error ? error.message : "Invalid Indian mobile",
      });
      return z.NEVER;
    }
  });

export type CreatePlatformVendorInput = z.infer<
  typeof createPlatformVendorSchema
>;

export type SafePlatformVendor = {
  id: string;
  name: string;
  slug: string;
  mobile: string | null;
  referralCode: string;
  onboardingStatus: VendorOnboardingStatus;
  isActive: boolean;
  createdAt: string;
};

export type SafeVendorInvite = {
  id: string;
  deliveryStatus: VendorRegistrationInviteDeliveryStatus;
  expiresAt: string;
  sentAt: string | null;
};

export class VendorInviteError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "CONFLICT"
      | "CONFIGURATION"
      | "DELIVERY_FAILED"
      | "DELIVERY_AMBIGUOUS",
    readonly retryable = false,
    readonly vendorId?: string,
  ) {
    super(message);
    this.name = "VendorInviteError";
  }
}

type VendorInviteDependencies = {
  now?: () => Date;
  getSmsConfig?: () => PlatformSmsConfig | null;
  createSmsProvider?: (config: PlatformSmsConfig) => MessageProvider;
  randomBytes?: (size: number) => Buffer;
};

function safeVendor(vendor: {
  id: string;
  name: string;
  slug: string;
  mobile: string | null;
  referralCode: string;
  onboardingStatus: VendorOnboardingStatus;
  isActive: boolean;
  createdAt: Date;
}): SafePlatformVendor {
  return {
    ...vendor,
    createdAt: vendor.createdAt.toISOString(),
  };
}

function slugBase(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base.length >= 2 ? base : "vendor";
}

function randomSuffix(random: (size: number) => Buffer): string {
  return random(5).toString("hex");
}

function buildIdentifiers(
  name: string,
  random: (size: number) => Buffer,
): { slug: string; referralCode: string } {
  const suffix = randomSuffix(random);
  const base = slugBase(name);
  const referralBase =
    base.replace(/-/g, "").toUpperCase().slice(0, 20) || "VENDOR";

  return {
    slug: `${base.slice(0, 48)}-${suffix}`,
    referralCode: `${referralBase}-${suffix.toUpperCase()}`.slice(0, 32),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function hashInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function renderApprovedInvitationBody(
  template: string,
  values: { registrationUrl: string; vendorName: string },
): string {
  const matches = [...template.matchAll(INVITATION_VARIABLE_PATTERN)];
  const variables = matches.map((match) => match[1] ?? match[2] ?? "");
  const expected = ["registrationUrl", "vendorName"];
  const staticContent = template.replace(INVITATION_VARIABLE_PATTERN, "");

  if (
    variables.length !== expected.length ||
    expected.some(
      (variable) => variables.filter((found) => found === variable).length !== 1,
    ) ||
    variables.some((variable) => !expected.includes(variable)) ||
    ["{{", "}}", "{#", "#}"].some((fragment) =>
      staticContent.includes(fragment),
    )
  ) {
    throw new VendorInviteError(
      "Platform SMS invitation template is not DLT-compatible",
      "CONFIGURATION",
    );
  }

  return template.replace(
    INVITATION_VARIABLE_PATTERN,
    (_placeholder, appVariable: string, dltVariable: string) =>
      values[(appVariable ?? dltVariable) as keyof typeof values],
  );
}

function safeDeliveryError(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return `Platform SMS failed (${error.code.slice(0, 64)})`;
  }
  if (error instanceof VendorInviteError && error.code === "CONFIGURATION") {
    return "Platform SMS configuration is invalid";
  }
  return "Platform SMS delivery failed";
}

const DEFINITE_SEND_FAILURE_CODES = new Set([
  "INVALID_BODY",
  "INVALID_RECIPIENT",
  "MISSING_TEMPLATE_ID",
  "INVALID_CREDENTIALS",
  "INSUFFICIENT_BALANCE",
  "INVALID_SENDER_ID",
  "INVALID_ROUTE",
  "SUBMISSION_ERROR",
  "PROVIDER_HTTP_4XX",
]);

function isDefinitelyRejected(
  error: unknown,
  sendAttempted: boolean,
): boolean {
  if (!sendAttempted) return true;
  return (
    error instanceof ProviderSendError &&
    DEFINITE_SEND_FAILURE_CODES.has(error.code)
  );
}

async function createDraftVendor(
  input: CreatePlatformVendorInput,
  actorAdminId: string,
  dependencies: VendorInviteDependencies,
) {
  const random = dependencies.randomBytes ?? randomBytes;

  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    const identifiers = buildIdentifiers(input.name, random);
    try {
      return await prisma.$transaction(async (tx) => {
        const vendor = await tx.vendor.create({
          data: {
            ...input,
            ...identifiers,
            onboardingStatus: VendorOnboardingStatus.DRAFT,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            mobile: true,
            referralCode: true,
            onboardingStatus: true,
            isActive: true,
            createdAt: true,
          },
        });
        await createPlatformAdminAuditEvent(
          {
            actorAdminId,
            action: PLATFORM_ADMIN_AUDIT_ACTIONS.VENDOR_CREATED,
            targetType: "vendor",
            targetId: vendor.id,
            after: {
              name: vendor.name,
              status: vendor.onboardingStatus,
            },
          },
          tx,
        );
        return vendor;
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      const duplicateMobile = await prisma.vendor.findUnique({
        where: { mobile: input.mobile },
        select: { id: true },
      });
      if (duplicateMobile) {
        throw new VendorInviteError(
          "A vendor with this mobile already exists",
          "CONFLICT",
        );
      }
    }
  }

  throw new VendorInviteError(
    "Could not allocate unique vendor identifiers",
    "CONFLICT",
    true,
  );
}

export async function issueVendorRegistrationInvite(
  vendorId: string,
  actorAdminId: string,
  dependencies: VendorInviteDependencies = {},
): Promise<{ vendor: SafePlatformVendor; invite: SafeVendorInvite }> {
  const now = dependencies.now?.() ?? new Date();
  const random = dependencies.randomBytes ?? randomBytes;
  const rawToken = random(32).toString("base64url");
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);

  let issued: {
    vendor: {
      id: string;
      name: string;
      mobile: string | null;
      onboardingStatus: VendorOnboardingStatus;
      _count: { users: number };
    };
    inviteId: string;
  };
  try {
    issued = await prisma.$transaction(async (tx) => {
      const vendor = await tx.vendor.findUnique({
        where: { id: vendorId },
        select: {
          id: true,
          name: true,
          mobile: true,
          onboardingStatus: true,
          _count: { select: { users: true } },
        },
      });
      if (!vendor) {
        throw new VendorInviteError("Vendor not found", "NOT_FOUND");
      }
      if (!vendor.mobile) {
        throw new VendorInviteError(
          "Vendor does not have a valid mobile",
          "CONFLICT",
        );
      }
      if (
        (vendor.onboardingStatus !== VendorOnboardingStatus.DRAFT &&
          vendor.onboardingStatus !== VendorOnboardingStatus.INVITED) ||
        vendor._count.users > 0
      ) {
        throw new VendorInviteError(
          "Only draft or invited vendors without users can be invited",
          "CONFLICT",
        );
      }

      const stalePendingCutoff = new Date(
        now.getTime() - PENDING_DISPATCH_LEASE_MS,
      );
      await tx.vendorRegistrationInvite.updateMany({
        where: {
          vendorId,
          deliveryStatus: VendorRegistrationInviteDeliveryStatus.PENDING,
          usedAt: null,
          revokedAt: null,
          createdAt: { lte: stalePendingCutoff },
        },
        data: {
          deliveryStatus: VendorRegistrationInviteDeliveryStatus.FAILED,
          revokedAt: now,
          deliveryError:
            "Invitation dispatch lease expired before an SMS outcome was recorded",
        },
      });

      const pendingInvite = await tx.vendorRegistrationInvite.findFirst({
        where: {
          vendorId,
          deliveryStatus: VendorRegistrationInviteDeliveryStatus.PENDING,
          usedAt: null,
          revokedAt: null,
        },
        select: { id: true },
      });
      if (pendingInvite) {
        throw new VendorInviteError(
          "An invitation SMS is already being dispatched",
          "CONFLICT",
        );
      }

      await tx.vendorRegistrationInvite.updateMany({
        where: {
          vendorId,
          usedAt: null,
          revokedAt: null,
          deliveryStatus: {
            not: VendorRegistrationInviteDeliveryStatus.PENDING,
          },
        },
        data: { revokedAt: now },
      });
      const invite = await tx.vendorRegistrationInvite.create({
        data: {
          vendorId,
          tokenHash,
          expiresAt,
          createdByAdminId: actorAdminId,
        },
        select: { id: true },
      });
      await tx.vendor.update({
        where: { id: vendorId },
        data: { onboardingStatus: VendorOnboardingStatus.DRAFT },
      });

      return { vendor, inviteId: invite.id };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new VendorInviteError(
        "An invitation SMS is already being dispatched",
        "CONFLICT",
      );
    }
    throw error;
  }

  let sendAttempted = false;
  try {
    const config = dependencies.getSmsConfig
      ? dependencies.getSmsConfig()
      : getPlatformSmsConfig();
    if (!config) {
      throw new VendorInviteError(
        "Platform SMS configuration is unavailable",
        "CONFIGURATION",
      );
    }

    const registrationUrl = new URL("/vendor/register", config.appUrl);
    registrationUrl.searchParams.set("token", rawToken);
    const body = renderApprovedInvitationBody(config.invitationBodyTemplate, {
      registrationUrl: registrationUrl.toString(),
      vendorName: issued.vendor.name,
    });
    const provider =
      dependencies.createSmsProvider?.(config) ??
      createLegacyHttpSmsProvider(config);

    sendAttempted = true;
    await provider.send({
      channel: "SMS",
      recipient: issued.vendor.mobile!,
      body,
      dltTemplateId: config.dltTemplateId,
      idempotencyKey: issued.inviteId,
      attemptNumber: 1,
    });

    const result = await prisma.$transaction(async (tx) => {
      const invite = await tx.vendorRegistrationInvite.update({
        where: { id: issued.inviteId },
        data: {
          deliveryStatus: VendorRegistrationInviteDeliveryStatus.SENT,
          sentAt: now,
          deliveryError: null,
        },
        select: {
          id: true,
          deliveryStatus: true,
          expiresAt: true,
          sentAt: true,
        },
      });
      const vendor = await tx.vendor.update({
        where: { id: vendorId },
        data: { onboardingStatus: VendorOnboardingStatus.INVITED },
        select: {
          id: true,
          name: true,
          slug: true,
          mobile: true,
          referralCode: true,
          onboardingStatus: true,
          isActive: true,
          createdAt: true,
        },
      });
      await createPlatformAdminAuditEvent(
        {
          actorAdminId,
          action: PLATFORM_ADMIN_AUDIT_ACTIONS.VENDOR_INVITE_SENT,
          targetType: "vendor",
          targetId: vendorId,
          before: { status: VendorOnboardingStatus.DRAFT },
          after: { status: VendorOnboardingStatus.INVITED },
        },
        tx,
      );
      return { vendor, invite };
    });

    return {
      vendor: safeVendor(result.vendor),
      invite: {
        ...result.invite,
        expiresAt: result.invite.expiresAt.toISOString(),
        sentAt: result.invite.sentAt?.toISOString() ?? null,
      },
    };
  } catch (error) {
    if (isDefinitelyRejected(error, sendAttempted)) {
      await prisma.$transaction([
        prisma.vendorRegistrationInvite.update({
          where: { id: issued.inviteId },
          data: {
            deliveryStatus: VendorRegistrationInviteDeliveryStatus.FAILED,
            revokedAt: now,
            deliveryError: safeDeliveryError(error),
          },
        }),
        prisma.vendor.update({
          where: { id: vendorId },
          data: { onboardingStatus: VendorOnboardingStatus.DRAFT },
        }),
      ]);

      throw new VendorInviteError(
        "Vendor invitation could not be sent; it can be retried",
        "DELIVERY_FAILED",
        true,
        vendorId,
      );
    }

    try {
      await prisma.$transaction([
        prisma.vendorRegistrationInvite.update({
          where: { id: issued.inviteId },
          data: {
            deliveryStatus: VendorRegistrationInviteDeliveryStatus.AMBIGUOUS,
            deliveryError: safeDeliveryError(error),
          },
        }),
        prisma.vendor.update({
          where: { id: vendorId },
          data: { onboardingStatus: VendorOnboardingStatus.INVITED },
        }),
      ]);
    } catch (persistenceError) {
      console.error(
        "Failed to persist ambiguous vendor invitation state",
        persistenceError,
      );
    }

    throw new VendorInviteError(
      "SMS delivery is uncertain. Verify with the vendor before reissuing.",
      "DELIVERY_AMBIGUOUS",
      false,
      vendorId,
    );
  }
}

export async function createVendorAndSendInvite(
  input: CreatePlatformVendorInput,
  actorAdminId: string,
  dependencies: VendorInviteDependencies = {},
) {
  const vendor = await createDraftVendor(input, actorAdminId, dependencies);
  return issueVendorRegistrationInvite(vendor.id, actorAdminId, dependencies);
}
