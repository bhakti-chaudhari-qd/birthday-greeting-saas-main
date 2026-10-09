/**
 * A contact a Platform Admin added on the client's behalf
 * (Contact.addedByPlatformAdmin) never shows its real mobile/email to anyone
 * on the client side - Owner and Staff alike. Only Platform Admin screens
 * read the stored values directly. Every client-facing serializer goes
 * through clientVisibleMobile/clientVisibleEmail below.
 */
type AdminAddedMarker = { addedByPlatformAdmin: boolean };

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

/** The mobile a client-side viewer may see for this contact. */
export function clientVisibleMobile(
  contact: AdminAddedMarker & { mobile: string },
): string {
  return contact.addedByPlatformAdmin
    ? maskMobileForDisplay(contact.mobile)
    : contact.mobile;
}

/** The email a client-side viewer may see for this contact. */
export function clientVisibleEmail(
  contact: AdminAddedMarker & { email: string | null },
): string | null {
  return contact.addedByPlatformAdmin && contact.email
    ? maskEmailForDisplay(contact.email)
    : contact.email;
}

/**
 * Prisma filter fragment for client-side search by mobile/email: masked
 * contacts must not match, or searching digits would reveal the hidden value.
 */
export const CLIENT_SEARCHABLE_CONTACT = { addedByPlatformAdmin: false } as const;
