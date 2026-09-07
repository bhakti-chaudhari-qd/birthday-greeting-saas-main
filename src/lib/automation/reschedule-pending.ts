import { QueueStatus } from "@prisma/client";

import {
  getAutomationSendInstant,
  isAutomationOriginatedIdempotencyKey,
} from "@/lib/automation/send-time";
import { prisma } from "@/lib/db";

/**
 * When the org changes Send at, hold or release today's pending automation
 * queue rows so the worker respects the new clock (manual sends untouched).
 */
export async function reschedulePendingAutomationQueueForSendTime(
  organizationId: string,
  sendHour: number,
  sendMinute: number,
  referenceDate: Date = new Date(),
): Promise<number> {
  const sendAt = getAutomationSendInstant(
    sendHour,
    sendMinute,
    referenceDate,
  );
  const windowOpen = sendAt.getTime() <= referenceDate.getTime();

  const pending = await prisma.sendQueue.findMany({
    where: {
      organizationId,
      status: QueueStatus.PENDING,
    },
    select: { id: true, idempotencyKey: true },
  });

  const automationIds = pending
    .filter((row) => isAutomationOriginatedIdempotencyKey(row.idempotencyKey))
    .map((row) => row.id);

  if (automationIds.length === 0) {
    return 0;
  }

  await prisma.sendQueue.updateMany({
    where: { id: { in: automationIds } },
    data: { nextAttemptAt: windowOpen ? null : sendAt },
  });

  return automationIds.length;
}