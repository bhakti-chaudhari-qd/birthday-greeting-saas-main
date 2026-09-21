/** The sender used when a client has no Email config of its own, and for system emails. */
export function getPlatformFromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Birthday Greeting <onboarding@resend.dev>"
  );
}
