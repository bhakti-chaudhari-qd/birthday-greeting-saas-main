import { redirect } from "next/navigation";

/** Tomorrow's List settings now live on the Daily Summary page. */
export default function AdminTomorrowListPage() {
  redirect("/admin/settings/daily-summary#tomorrow-list");
}
