import { Prisma, SubscriptionPlan, type PrismaClient } from "@prisma/client";

import {
  DEFAULT_PAID_PERIOD_DAYS,
  applyCheckoutPlanToOrganization,
  applyCreditPackToOrganization,
  applyPaymentLinkDealToOrganization,
  extendSubscriptionPaidUntil,
  markSubscriptionCancelled,
  markSubscriptionPastDue,
} from "@/lib/billing/apply-plan";
import { isCheckoutPlan, isCreditPackId } from "@/lib/billing/catalogue";
import { prisma as defaultPrisma } from "@/lib/db";

export type RazorpayWebhookPayload = {
  event?: string;
  id?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        status?: string;
        notes?: Record<string, string | undefined>;
      };
    };
    order?: {
      entity?: {
        id?: string;
        notes?: Record<string, string | undefined>;
        status?: string;
      };
    };
    payment_link?: {
      entity?: {
        id?: string;
        notes?: Record<string, string | undefined>;
        status?: string;
      };
    };
    subscription?: {
      entity?: {
        id?: string;
        notes?: Record<string, string | undefined>;
        status?: string;
      };
    };
  };
};

export type ProcessWebhookResult =
  | { outcome: "ignored"; reason: string }
  | { outcome: "duplicate"; eventId: string }
  | {
      outcome: "applied";
      eventId: string;
      organizationId: string;
      action:
        | "activated"
        | "credits_applied"
        | "renewed"
        | "past_due"
        | "cancelled";
    };

function resolveNotes(
  payload: RazorpayWebhookPayload,
): Record<string, string | undefined> {
  return (
    payload.payload?.payment?.entity?.notes ||
    payload.payload?.order?.entity?.notes ||
    payload.payload?.payment_link?.entity?.notes ||
    payload.payload?.subscription?.entity?.notes ||
    {}
  );
}

async function markCheckoutPaidByOrder(
  db: PrismaClient,
  organizationId: string,
  orderId: string | undefined,
  paymentId?: string,
) {
  if (!orderId) return;
  await db.billingCheckout.updateMany({
    where: { organizationId, razorpayOrderId: orderId },
    data: {
      status: "PAID",
      ...(paymentId ? { razorpayPaymentId: paymentId } : {}),
    },
  });
}

export async function processRazorpayWebhook(
  payload: RazorpayWebhookPayload,
  db: PrismaClient = defaultPrisma,
): Promise<ProcessWebhookResult> {
  const eventType = payload.event?.trim();
  const eventId = payload.id?.trim();

  if (!eventType || !eventId) {
    return { outcome: "ignored", reason: "missing_event_fields" };
  }

  try {
    await db.billingEvent.create({
      data: {
        razorpayEventId: eventId,
        eventType,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { outcome: "duplicate", eventId };
    }
    throw error;
  }

  const notes = resolveNotes(payload);
  const organizationId = notes.organizationId?.trim();
  const kind = notes.kind?.trim().toUpperCase();
  const planRaw = notes.plan?.trim();
  const packIdRaw = notes.packId?.trim();
  const subscriptionEntityId = payload.payload?.subscription?.entity?.id;

  if (!organizationId) {
    await db.billingEvent.update({
      where: { razorpayEventId: eventId },
      data: { processNote: "missing_organizationId_in_notes" },
    });
    return { outcome: "ignored", reason: "missing_organizationId" };
  }

  await db.billingEvent.update({
    where: { razorpayEventId: eventId },
    data: { organizationId },
  });

  const orderId =
    payload.payload?.payment?.entity?.order_id ||
    payload.payload?.order?.entity?.id;
  const paymentId = payload.payload?.payment?.entity?.id;
  const paymentLinkId = payload.payload?.payment_link?.entity?.id;

  if (
    eventType === "subscription.charged" ||
    eventType === "invoice.paid"
  ) {
    await extendSubscriptionPaidUntil(
      organizationId,
      DEFAULT_PAID_PERIOD_DAYS,
      db,
    );
    if (subscriptionEntityId) {
      await db.subscription.updateMany({
        where: { organizationId },
        data: { razorpaySubscriptionId: subscriptionEntityId },
      });
    }
    return {
      outcome: "applied",
      eventId,
      organizationId,
      action: "renewed",
    };
  }

  if (
    eventType === "payment.captured" ||
    eventType === "order.paid" ||
    eventType === "payment_link.paid"
  ) {
    if (kind === "CREDITS" || (packIdRaw && isCreditPackId(packIdRaw))) {
      if (!packIdRaw || !isCreditPackId(packIdRaw)) {
        await db.billingEvent.update({
          where: { razorpayEventId: eventId },
          data: { processNote: "invalid_or_missing_packId" },
        });
        return { outcome: "ignored", reason: "invalid_pack" };
      }

      const existingCheckout = orderId
        ? await db.billingCheckout.findUnique({
            where: { razorpayOrderId: orderId },
          })
        : null;

      if (existingCheckout?.status !== "PAID") {
        await applyCreditPackToOrganization(organizationId, packIdRaw, db);
        await markCheckoutPaidByOrder(db, organizationId, orderId, paymentId);
      }

      return {
        outcome: "applied",
        eventId,
        organizationId,
        action: "credits_applied",
      };
    }

    if (kind === "PAYMENT_LINK" || paymentLinkId) {
      const checkout = paymentLinkId
        ? await db.billingCheckout.findFirst({
            where: {
              organizationId,
              razorpayPaymentLinkId: paymentLinkId,
            },
          })
        : null;

      const plan =
        checkout?.plan ??
        (planRaw && Object.values(SubscriptionPlan).includes(planRaw as SubscriptionPlan)
          ? (planRaw as SubscriptionPlan)
          : null);

      if (!plan || !checkout) {
        await db.billingEvent.update({
          where: { razorpayEventId: eventId },
          data: { processNote: "invalid_payment_link_checkout" },
        });
        return { outcome: "ignored", reason: "invalid_payment_link" };
      }

      // Only a still-outstanding link may be applied. A CANCELLED (or any
      // other non-CREATED) checkout must never activate a deal, even if a
      // stray/late webhook event arrives for it after cancellation.
      if (checkout.status === "CREATED") {
        const smsLimit =
          checkout.dealSmsLimit ??
          (notes.smsMonthlyLimit != null
            ? Number.parseInt(notes.smsMonthlyLimit, 10)
            : undefined);
        const whatsappLimit =
          checkout.dealWhatsappLimit ??
          (notes.whatsappMonthlyLimit != null
            ? Number.parseInt(notes.whatsappMonthlyLimit, 10)
            : undefined);
        const emailLimit =
          checkout.dealEmailLimit ??
          (notes.emailMonthlyLimit != null
            ? Number.parseInt(notes.emailMonthlyLimit, 10)
            : undefined);

        await applyPaymentLinkDealToOrganization(
          {
            organizationId,
            plan,
            contactLimit:
              checkout.dealContactLimit ??
              Number.parseInt(notes.contactLimit ?? "500", 10),
            monthlyMessageLimit:
              checkout.dealMonthlyMessageLimit ??
              Number.parseInt(notes.monthlyMessageLimit ?? "500", 10),
            smsLimit: smsLimit ?? undefined,
            whatsappLimit: whatsappLimit ?? undefined,
            emailLimit: emailLimit ?? undefined,
            durationDays: checkout.durationDays ?? DEFAULT_PAID_PERIOD_DAYS,
            amountPaise: checkout.amountPaise,
            billingCheckoutId: checkout.id,
          },
          db,
        );
        await db.billingCheckout.update({
          where: { id: checkout.id },
          data: {
            status: "PAID",
            ...(paymentId ? { razorpayPaymentId: paymentId } : {}),
          },
        });
      }

      return {
        outcome: "applied",
        eventId,
        organizationId,
        action: "activated",
      };
    }

    if (!planRaw || !isCheckoutPlan(planRaw)) {
      await db.billingEvent.update({
        where: { razorpayEventId: eventId },
        data: { processNote: "invalid_or_missing_plan" },
      });
      return { outcome: "ignored", reason: "invalid_plan" };
    }

    const existingCheckout = orderId
      ? await db.billingCheckout.findUnique({
          where: { razorpayOrderId: orderId },
        })
      : subscriptionEntityId
        ? await db.billingCheckout.findFirst({
            where: {
              organizationId,
              razorpaySubscriptionId: subscriptionEntityId,
            },
            orderBy: { createdAt: "desc" },
          })
        : null;

    if (existingCheckout?.status !== "PAID") {
      await applyCheckoutPlanToOrganization(organizationId, planRaw, db, {
        durationDays: existingCheckout?.durationDays ?? DEFAULT_PAID_PERIOD_DAYS,
        razorpaySubscriptionId:
          existingCheckout?.razorpaySubscriptionId ?? subscriptionEntityId,
      });
      if (existingCheckout) {
        await db.billingCheckout.update({
          where: { id: existingCheckout.id },
          data: {
            status: "PAID",
            ...(paymentId ? { razorpayPaymentId: paymentId } : {}),
          },
        });
      } else {
        await markCheckoutPaidByOrder(db, organizationId, orderId, paymentId);
      }
    }

    return {
      outcome: "applied",
      eventId,
      organizationId,
      action: "activated",
    };
  }

  if (eventType === "payment.failed") {
    const failedOrderId = payload.payload?.payment?.entity?.order_id;
    if (failedOrderId) {
      const failedCheckout = await db.billingCheckout.findUnique({
        where: { razorpayOrderId: failedOrderId },
      });
      await db.billingCheckout.updateMany({
        where: {
          organizationId,
          razorpayOrderId: failedOrderId,
        },
        data: { status: "FAILED" },
      });

      if (
        failedCheckout?.kind === "CREDITS" ||
        kind === "CREDITS" ||
        (packIdRaw && isCreditPackId(packIdRaw))
      ) {
        await db.billingEvent.update({
          where: { razorpayEventId: eventId },
          data: { processNote: "credit_checkout_failed" },
        });
        return { outcome: "ignored", reason: "credit_payment_failed" };
      }
    }

    await markSubscriptionPastDue(organizationId, db);
    return {
      outcome: "applied",
      eventId,
      organizationId,
      action: "past_due",
    };
  }

  if (
    eventType === "subscription.cancelled" ||
    eventType === "subscription.halted" ||
    eventType === "payment.cancelled"
  ) {
    await markSubscriptionCancelled(organizationId, db);
    return {
      outcome: "applied",
      eventId,
      organizationId,
      action: "cancelled",
    };
  }

  await db.billingEvent.update({
    where: { razorpayEventId: eventId },
    data: { processNote: `unhandled_event:${eventType}` },
  });
  return { outcome: "ignored", reason: `unhandled:${eventType}` };
}
