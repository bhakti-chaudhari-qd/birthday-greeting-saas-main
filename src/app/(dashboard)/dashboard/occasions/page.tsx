import { OccasionType, type OccasionType as OccasionTypeValue } from "../../../../lib/automation/occasion-types";
import { redirect } from "next/navigation";

import { OccasionsListClient } from "@/components/dashboard/occasions-list-client";
import { getAuthContext } from "@/lib/auth/context";
import { AUTOMATION_TIMEZONE } from "@/lib/automation/constants";
import { listContactCategories } from "@/lib/contacts/categories";
import { getOrganizationLocalIsoDate } from "@/lib/queue/dates";
import { getOccasionsDayView } from "@/lib/queue/occasions-day-view";

function parseOccasionType(value: string | undefined): OccasionTypeValue {
  if (value === OccasionType.ANNIVERSARY || value === OccasionType.CUSTOM) {
    return value;
  }
  return OccasionType.BIRTHDAY;
}

export default async function OccasionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    date?: string;
    categoryId?: string;
  }>;
}) {
  const auth = await getAuthContext();
  if (!auth) {
    redirect("/login");
  }

  const params = await searchParams;
  const todayDate = getOrganizationLocalIsoDate(AUTOMATION_TIMEZONE);
  const type = parseOccasionType(params.type);
  const date =
    typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : todayDate;
  const requestedCategoryId =
    typeof params.categoryId === "string" && params.categoryId.trim()
      ? params.categoryId.trim()
      : "all";

  const categories = await listContactCategories(auth.organizationId);
  const categoryId =
    requestedCategoryId === "all" ||
    categories.some((category) => category.id === requestedCategoryId)
      ? requestedCategoryId
      : "all";

  const view = await getOccasionsDayView(
    auth.organizationId,
    date,
    categoryId === "all" ? undefined : categoryId,
  );

  return (
    <OccasionsListClient
      initialView={view}
      categories={categories}
      initialType={type}
      initialCategoryId={categoryId}
      todayDate={todayDate}
    />
  );
}
