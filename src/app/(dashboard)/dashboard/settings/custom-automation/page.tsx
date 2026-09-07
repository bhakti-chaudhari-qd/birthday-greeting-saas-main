import { redirect } from "next/navigation";

export default function LegacyCustomAutomationPage() {
  redirect("/dashboard/settings/greeting-routes");
}
