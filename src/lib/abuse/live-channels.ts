import { ChannelConfigValidationError } from "@/lib/channel-config/errors";

/** Block insecure WhatsApp TLS when running in production. */
export function assertWhatsAppTlsAllowed(tlsInsecure: boolean): void {
  if (process.env.NODE_ENV === "production" && tlsInsecure) {
    throw new ChannelConfigValidationError(
      "Insecure TLS (tlsInsecure) is not allowed for WhatsApp in production",
    );
  }
}
