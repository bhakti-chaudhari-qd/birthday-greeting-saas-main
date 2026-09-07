export { getMessageProvider, resolveMessageProvider } from "./factory";
export { testProvider } from "./test-provider";
export { createResendEmailProvider } from "./email/resend-email-provider";
export {
  buildLegacySmsSendUrl,
  buildLegacySmsStatusUrl,
  createLegacyHttpSmsProvider,
} from "./sms/legacy-http-sms-provider";
export {
  mapProviderStatusToOutcome,
  normalizeProviderStatusString,
  parseLegacySmsStatusResponse,
  selectRecipientStatusRecord,
} from "./sms/parse-status-response";
export {
  mapLegacySmsStatusToError,
  parseLegacySmsResponse,
} from "./sms/parse-response";
export {
  formatIndianSmsRecipient,
  formatIndianSmsRecipientDigits,
} from "./sms/format-recipient";
export {
  buildCustomWhatsAppSendUrl,
  createCustomHttpWhatsAppProvider,
} from "./whatsapp/custom-http-whatsapp-provider";
export { formatIndianWhatsAppRecipient } from "./whatsapp/format-recipient";
export { parseCustomWhatsAppSendResponse } from "./whatsapp/parse-response";
export {
  DeliveryStatusLookupError,
  ProviderSendError,
  isDeliveryStatusCapable,
  isEmailSendRequest,
  isSmsSendRequest,
  isWhatsAppSendRequest,
  type DeliveryStatusCapableProvider,
  type DeliveryStatusLookupRequest,
  type EmailMessageSendRequest,
  type MessageProvider,
  type MessageSendRequest,
  type MessageSendResult,
  type ProviderDeliveryOutcome,
  type ProviderDeliveryStatusResult,
  type SmsMessageSendRequest,
  type WhatsAppMessageSendRequest,
} from "./types";
