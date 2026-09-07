import { redirect } from "next/navigation";

/** Legacy WhatsApp settings URL - channels hub lives under Settings → Channels. */
export default function LegacyWhatsAppSettingsPage() {
  redirect("/dashboard/settings/channels?tab=whatsapp");
}
