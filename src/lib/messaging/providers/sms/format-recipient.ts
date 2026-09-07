import { toIndianProviderMobileDigits } from "@/lib/contacts/mobile";

import { ProviderSendError } from "@/lib/messaging/providers/types";

/**
 * Converts stored Indian mobiles to the provider-required 12-digit format.
 * Example: Phone Number -> country-code-prefixed phone number
 */
export function formatIndianSmsRecipient(mobile: string): string {
  try {
    return toIndianProviderMobileDigits(mobile);
  } catch {
    throw new ProviderSendError(
      "SMS provider only supports Indian mobile numbers",
      "INVALID_RECIPIENT",
    );
  }
}

/**
 * Provider status lookup digits for supported Indian recipients.
 * Reuses the same send-adapter formatting before digit normalization.
 */
export function formatIndianSmsRecipientDigits(mobile: string): string {
  return formatIndianSmsRecipient(mobile).replace(/\D/g, "");
}
