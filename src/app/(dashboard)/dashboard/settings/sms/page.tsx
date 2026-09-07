import { redirect } from "next/navigation";

/** Legacy SMS settings URL - channels hub lives under Settings → Channels. */
export default function LegacySmsSettingsPage() {
  redirect("/dashboard/settings/channels");
}
