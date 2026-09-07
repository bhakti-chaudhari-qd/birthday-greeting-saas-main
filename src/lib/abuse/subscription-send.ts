import { SubscriptionStatus } from "@prisma/client";

import { QueueValidationError } from "@/lib/queue/errors";

export class SubscriptionBlockedError extends QueueValidationError {
  readonly code: "SUBSCRIPTION_INACTIVE" | "MONTHLY_CAPACITY";

  constructor(
    message: string,
    code: "SUBSCRIPTION_INACTIVE" | "MONTHLY_CAPACITY" = "SUBSCRIPTION_INACTIVE",
  ) {
    super(message);
    this.name = "SubscriptionBlockedError";
    this.code = code;
  }
}

export function assertSubscriptionAllowsSending(subscription: {
  status: SubscriptionStatus;
}): void {
  if (subscription.status === SubscriptionStatus.ACTIVE) {
    return;
  }

  if (subscription.status === SubscriptionStatus.PAST_DUE) {
    throw new SubscriptionBlockedError(
      "Subscription is past due. Update billing before sending messages.",
    );
  }

  throw new SubscriptionBlockedError(
    "Subscription is cancelled. Choose an active plan before sending messages.",
  );
}
