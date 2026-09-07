import { redirect } from "next/navigation";

export default function LegacyBirthdayAutomationPage() {
  redirect("/dashboard/settings/greeting-routes");
}
