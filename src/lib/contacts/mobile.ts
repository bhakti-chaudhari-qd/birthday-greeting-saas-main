/** Indian local mobile: 10 digits, first digit 6-9. */
export const INDIAN_LOCAL_MOBILE_PATTERN = /^[6-9]\d{9}$/;

const INDIAN_E164_PATTERN = /^\+91[6-9]\d{9}$/;
const INDIAN_COUNTRY_PREFIX_PATTERN = /^91[6-9]\d{9}$/;

export const MOBILE_MUST_BE_TEN_DIGITS_MESSAGE =
  "Mobile must be exactly 10 digits.";

/**
 * Live input sanitizer for the contact form:
 * digits only, strip pasted +91 / 91 / leading 0, hard-cap at 10 digits.
 * Country code is never typed - the system applies +91 on send.
 */
export function sanitizeMobileInput(raw: string): string {
  let digits = raw.replace(/\D/g, "");

  if (digits.length >= 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

/**
 * Normalize contact mobiles for storage:
 * - Strip spaces, dashes, and parentheses
 * - Accept 10-digit local, +91, or 91 prefix forms
 * - Store exactly 10 digits (no country code); +91 is added by providers on send
 */
export function normalizeMobile(input: string): string {
  const compact = input.trim().replace(/[\s()-]/g, "");

  if (INDIAN_LOCAL_MOBILE_PATTERN.test(compact)) {
    return compact;
  }

  if (INDIAN_E164_PATTERN.test(compact)) {
    return compact.slice(3);
  }

  if (INDIAN_COUNTRY_PREFIX_PATTERN.test(compact)) {
    return compact.slice(2);
  }

  // Tolerate a leading 0 on local numbers pasted with an extra trunk prefix.
  if (/^0[6-9]\d{9}$/.test(compact)) {
    return compact.slice(1);
  }

  throw new Error(MOBILE_MUST_BE_TEN_DIGITS_MESSAGE);
}

/**
 * Provider gateways expect 12-digit Indian numbers (91 + 10-digit local).
 */
export function toIndianProviderMobileDigits(mobile: string): string {
  return `91${normalizeMobile(mobile)}`;
}
