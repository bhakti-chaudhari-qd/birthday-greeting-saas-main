import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { ActivityPageClient } from "@/components/activity/activity-page-client";
import { AUTOMATION_TIMEZONE } from "@/lib/automation/constants";
import { getAuthContext } from "@/lib/auth/context";
import { listContactCategories } from "@/lib/contacts/categories";
import { getOrganizationLocalIsoDate } from "@/lib/queue/dates";

type ActivityStatusFilter = "all" | "sent" | "failed" | "pending";

/** Old links used ?tab=upcoming|sent|failed; map them onto the new status filter. */
function statusFromLegacyTab(tab: string | undefined): ActivityStatusFilter {
  if (tab === "sent") return "sent";
  if (tab === "failed") return "failed";
  if (tab === "upcoming") return "pending";
  return "all";
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    status?: string;
    search?: string;
    channel?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    occasionId?: string;
    categoryId?: string;
  }>;
}) {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");

  const params = await searchParams;
  const initialStatus: ActivityStatusFilter =
    params.status === "all" ||
    params.status === "sent" ||
    params.status === "failed" ||
    params.status === "pending"
      ? params.status
      : statusFromLegacyTab(params.tab);

  const todayIst = getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE);
  const isValidDate = (value: string | undefined): value is string =>
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  // Legacy links (dashboard home, help center) still pass a single ?date= -
  // treat that as both endpoints of the range.
  const legacyDate = isValidDate(params.date) ? params.date : undefined;
  const initialStartDate =
    (isValidDate(params.startDate) ? params.startDate : undefined) ??
    legacyDate ??
    todayIst;
  const initialEndDate =
    (isValidDate(params.endDate) ? params.endDate : undefined) ??
    legacyDate ??
    todayIst;

  const categories = await listContactCategories(auth.organizationId);
  const knownCategory =
    typeof params.categoryId === "string" &&
    categories.some((category) => category.id === params.categoryId);

  return (
    <ActivityPageClient
      canManage={auth.role === UserRole.ADMIN}
      initialSearch={params.search ?? ""}
      initialStatus={initialStatus}
      initialChannel={
        params.channel === "SMS" ||
        params.channel === "WHATSAPP" ||
        params.channel === "EMAIL"
          ? params.channel
          : ""
      }
      initialOccasionId={params.occasionId ?? ""}
      initialCategoryId={knownCategory ? params.categoryId! : ""}
      initialStartDate={initialStartDate}
      initialEndDate={initialEndDate}
      todayDate={todayIst}
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name,
      }))}
    />
  );
}
