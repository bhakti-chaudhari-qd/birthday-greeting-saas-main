/** Same shape as the provider-log masking (e.g. "******3210"). */
export function maskMobileForDisplay(mobile: string): string {
  return mobile.length <= 4
    ? mobile
    : `${"*".repeat(mobile.length - 4)}${mobile.slice(-4)}`;
}

/** "jo***@example.com" - keeps up to 2 leading local-part characters and the domain. */
export function maskEmailForDisplay(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) {
    return "***";
  }

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  const maskedLength = Math.max(local.length - visible.length, 3);

  return `${visible}${"*".repeat(maskedLength)}@${domain}`;
}
