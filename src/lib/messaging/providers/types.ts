export type SmsMessageSendRequest = {
  channel: "SMS";
  recipient: string;
  body: string;
  idempotencyKey: string;
  attemptNumber: number;
  dltTemplateId?: string | null;
};

export type WhatsAppMessageSendRequest = {
  channel: "WHATSAPP";
  recipient: string;
  templateName: string;
  language: string;
  parameterValues: string[];
  renderedBody: string;
  media?: {
    bytes: Buffer;
    filename: string;
    contentType: string;
  };
  idempotencyKey: string;
  attemptNumber: number;
};

/**
 * Provider-agnostic email attachment. Only what the delivery layer needs to
 * ship a file with an email - no document/storage-system knowledge belongs
 * here (see src/lib/queue/document-attachment.ts for that boundary).
 */
export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type EmailMessageSendRequest = {
  channel: "EMAIL";
  recipient: string;
  subject: string;
  body: string;
  idempotencyKey: string;
  attemptNumber: number;
  attachments?: EmailAttachment[];
};

export type MessageSendRequest =
  | SmsMessageSendRequest
  | WhatsAppMessageSendRequest
  | EmailMessageSendRequest;

export function isWhatsAppSendRequest(
  request: MessageSendRequest,
): request is WhatsAppMessageSendRequest {
  return request.channel === "WHATSAPP";
}

export function isSmsSendRequest(
  request: MessageSendRequest,
): request is SmsMessageSendRequest {
  return request.channel === "SMS";
}

export function isEmailSendRequest(
  request: MessageSendRequest,
): request is EmailMessageSendRequest {
  return request.channel === "EMAIL";
}

export type MessageSendResult = {
  providerMessageId: string;
  status: "SENT";
  units?: number;
};

export type DeliveryStatusLookupRequest = {
  providerMessageId: string;
  submissionDate: string;
  recipient: string;
};

export type ProviderDeliveryOutcome =
  | "delivered"
  | "undelivered"
  | "pending"
  | "unknown";

export type ProviderDeliveryStatusResult = {
  outcome: ProviderDeliveryOutcome;
  rawProviderStatus: string;
  providerMessage?: string;
};

export class ProviderSendError extends Error {
  readonly code: string;

  constructor(message: string, code = "PROVIDER_SEND_FAILED") {
    super(message);
    this.name = "ProviderSendError";
    this.code = code;
  }
}

export class DeliveryStatusLookupError extends Error {
  readonly code: string;

  constructor(message: string, code = "DELIVERY_STATUS_LOOKUP_FAILED") {
    super(message);
    this.name = "DeliveryStatusLookupError";
    this.code = code;
  }
}

export type MessageProvider = {
  readonly name: string;
  send(request: MessageSendRequest): Promise<MessageSendResult>;
};

export type DeliveryStatusCapableProvider = MessageProvider & {
  getDeliveryStatus(
    request: DeliveryStatusLookupRequest,
  ): Promise<ProviderDeliveryStatusResult>;
};

export function isDeliveryStatusCapable(
  provider: MessageProvider,
): provider is DeliveryStatusCapableProvider {
  return (
    typeof (provider as DeliveryStatusCapableProvider).getDeliveryStatus ===
    "function"
  );
}
