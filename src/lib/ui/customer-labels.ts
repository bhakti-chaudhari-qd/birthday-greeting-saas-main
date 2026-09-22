/**
 * Customer-facing labels for dashboard UI.
 * Keep provider enum values (TEST, CUSTOM_HTTP) in APIs and forms;
 * only change what customers read.
 */

export function getCustomerSmsProviderLabel(
  provider: "TEST" | "CUSTOM_HTTP" | string | null | undefined,
): string {
  if (provider === "TEST") {
    return "Test";
  }

  if (provider === "CUSTOM_HTTP") {
    return "Custom HTTP";
  }

  if (!provider) {
    return "Not configured";
  }

  return "SMS provider";
}

export function getCustomerWhatsAppProviderLabel(
  provider: "TEST" | "CUSTOM_HTTP" | "META" | string | null | undefined,
): string {
  if (provider === "TEST") {
    return "Test";
  }

  if (provider === "CUSTOM_HTTP") {
    return "Custom HTTP";
  }

  if (provider === "META") {
    return "Meta Cloud API";
  }

  if (!provider) {
    return "Not configured";
  }

  return "WhatsApp provider";
}

export function getCustomerEmailProviderLabel(
  provider: "TEST" | "RESEND" | string | null | undefined,
): string {
  if (provider === "TEST") {
    return "Test";
  }

  if (provider === "RESEND") {
    return "Resend";
  }

  if (!provider) {
    return "Not configured";
  }

  return "Email provider";
}

export function getCustomerDeliveryStatusLabel(status: string): string {
  switch (status) {
    case "SENT":
      return "Submitted";
    case "DELIVERED":
      return "Delivered";
    case "UNDELIVERED":
      return "Not delivered";
    case "FAILED":
      return "Failed";
    case "QUEUED":
      return "Sending";
    case "READ":
      return "Read";
    default:
      return status;
  }
}

export function getCustomerDeliveryStatusHint(status: string): string | null {
  if (status === "SENT") {
    return "Submitted means the carrier accepted the message. It does not guarantee the phone received it.";
  }

  if (status === "QUEUED") {
    return "Submitted and being processed.";
  }

  if (status === "DELIVERED") {
    return "Confirmed delivered to the handset.";
  }

  return null;
}

export function getCustomerQueueStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "SENDING":
      return "Sending";
    case "SENT":
      return "Submitted";
    case "FAILED":
      return "Failed";
    case "SKIPPED":
      return "Skipped";
    case "DELIVERED":
      return "Delivered";
    default:
      return status;
  }
}

/**
 * Labels for Today’s occasions channel/overall status.
 * Queued states match Scheduled (`getCustomerQueueStatusLabel`).
 */
export function getOccasionStatusLabel(
  status:
    | "not_set_up"
    | "will_send"
    | "pending"
    | "sending"
    | "sent"
    | "failed"
    | "skipped"
    | "not_scheduled",
): string {
  switch (status) {
    case "not_set_up":
      return "Not set up";
    case "will_send":
    case "not_scheduled":
      return "Scheduled";
    case "pending":
      return getCustomerQueueStatusLabel("PENDING");
    case "sending":
      return getCustomerQueueStatusLabel("SENDING");
    case "sent":
      return getCustomerQueueStatusLabel("SENT");
    case "failed":
      return getCustomerQueueStatusLabel("FAILED");
    case "skipped":
      return getCustomerQueueStatusLabel("SKIPPED");
    default:
      return status;
  }
}

/** Primary report filters for Delivery results (API DeliveryStatus values). */
export const DELIVERY_REPORT_FILTERS = [
  { value: "", label: "All" },
  { value: "SENT", label: "Submitted" },
  { value: "FAILED", label: "Failed" },
] as const;

/** Extra delivery statuses kept behind a secondary control. */
export const DELIVERY_MORE_STATUS_FILTERS = [
  { value: "DELIVERED", label: "Delivered" },
  { value: "UNDELIVERED", label: "Not delivered" },
  { value: "QUEUED", label: "Sending" },
] as const;

/** Primary report filters for Scheduled Messages (API QueueStatus values). */
export const QUEUE_REPORT_FILTERS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "SENT", label: "Submitted" },
] as const;

export const QUEUE_MORE_STATUS_FILTERS = [
  { value: "SENDING", label: "Sending" },
  { value: "SKIPPED", label: "Skipped" },
  { value: "DELIVERED", label: "Delivered" },
] as const;
