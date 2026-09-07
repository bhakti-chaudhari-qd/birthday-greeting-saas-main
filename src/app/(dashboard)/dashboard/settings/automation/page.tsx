import { redirect } from "next/navigation";

/** Legacy Automatic greetings URL - category routes now live under Settings. */
export default function LegacyAutomationSettingsPage() {
  redirect("/dashboard/settings/greeting-routes");
}
