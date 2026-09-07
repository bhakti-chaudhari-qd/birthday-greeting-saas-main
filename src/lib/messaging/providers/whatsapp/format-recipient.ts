import { toIndianProviderMobileDigits } from "@/lib/contacts/mobile";

import { ProviderSendError } from "@/lib/messaging/providers/types";

/**
 * Converts stored Indian mobiles to the CustomAPI 12-digit format.
 * Example: Phone Number -> country-code-prefixed phone number
 */
export function formatIndianWhatsAppRecipient(mobile: string): string {
  try {
    return toIndianProviderMobileDigits(mobile);
  } catch {
    throw new ProviderSendError(
      "WhatsApp provider only supports Indian mobile numbers",
      "INVALID_RECIPIENT",
    );
  }
}
